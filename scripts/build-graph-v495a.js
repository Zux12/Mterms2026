'use strict';
// Jalan V4.9.5a: two-pass validation then isolated graph import. Dry run by default.
require('dotenv').config();
const mongoose=require('mongoose');
const crypto=require('crypto');
const DB='jalan_navigation', SOURCE='road_network_v493', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493', TARGET='road_graph_edges_v495';
const EXPECTED={roads:31525,restrictions:1941,quarantine:45,eligibleRoads:27710,excludedRoads:3815,segments:112845,directedEdges:168221,forwardEdges:112845,reverseEdges:55376,invalidRoads:0};
const args=process.argv.slice(2),write=args.includes('--write');
if(args.some(x=>x!=='--write')||args.filter(x=>x==='--write').length>1){console.error('Usage: node scripts/build-graph-v495a.js [--write]');process.exit(1);}
const blocked=new Set(['no','private','agricultural','forestry']);
function accessAllowed(r){return ![r.access,r.motorVehicle,r.vehicle].some(v=>blocked.has(String(v||'').toLowerCase()));}
function direction(r){const d=String(r.onewayDirection||'').toLowerCase();if(['-1','reverse','backward'].includes(d))return 'reverse';if(r.oneway||['yes','1','true','forward'].includes(d))return 'forward';return 'both';}
function edgesForRoad(r){const ids=r.nodeIds||[],pts=r.geometry?.coordinates||[];if(ids.length<2||ids.length!==pts.length)throw Error('Bad node/coordinate alignment: '+r.roadId);
 const dir=direction(r),result=[];
 for(let i=1;i<ids.length;i++){
  const a=ids[i-1],b=ids[i],p=pts[i-1],q=pts[i];if(a===b)continue;
  if(!Array.isArray(p)||!Array.isArray(q)||p.length!==2||q.length!==2||![...p,...q].every(Number.isFinite))throw Error('Bad coordinates: '+r.roadId);
  const base={roadId:r.roadId,segment:i-1,highway:r.highway||'',regionKey:r.regionKey||'',layer:r.layer??null,bridge:r.bridge||'',tunnel:r.tunnel||'',access:r.access||'',motorVehicle:r.motorVehicle||'',vehicle:r.vehicle||'',sourceVersion:r.sourceVersion||''};
  if(dir!=='reverse')result.push({...base,edgeId:`${r.roadId}:${i-1}:F`,fromNode:String(a),toNode:String(b),coordinates:[p,q],direction:'F'});
  if(dir!=='forward')result.push({...base,edgeId:`${r.roadId}:${i-1}:R`,fromNode:String(b),toNode:String(a),coordinates:[q,p],direction:'R'});
 }return result;
}
const projection={roadId:1,nodeIds:1,geometry:1,oneway:1,onewayDirection:1,highway:1,regionKey:1,layer:1,bridge:1,tunnel:1,access:1,motorVehicle:1,vehicle:1,sourceVersion:1};
async function scan(db,{onBatch}={}){
 const stats={roads:EXPECTED.roads,restrictions:EXPECTED.restrictions,quarantine:EXPECTED.quarantine,eligibleRoads:0,excludedRoads:0,segments:0,directedEdges:0,forwardEdges:0,reverseEdges:0,invalidRoads:0,sharedNodes:0,uniqueNodes:0,components:0,largestComponentNodes:0};
 const parent=new Map(),size=new Map(),degree=new Map(),hash=crypto.createHash('sha256');
 function root(x){if(!parent.has(x)){parent.set(x,x);size.set(x,1);}let p=x;while(parent.get(p)!==p)p=parent.get(p);while(parent.get(x)!==x){const y=parent.get(x);parent.set(x,p);x=y;}return p;}
 function union(a,b){let x=root(a),y=root(b);if(x===y)return;if(size.get(x)<size.get(y))[x,y]=[y,x];parent.set(y,x);size.set(x,size.get(x)+size.get(y));}
 let batch=[];
 for await(const r of db.collection(SOURCE).find({},{projection}).sort({roadId:1}).batchSize(200)){
  if(!accessAllowed(r)){stats.excludedRoads++;continue;}
  const edges=edgesForRoad(r);stats.eligibleRoads++;stats.directedEdges+=edges.length;
  stats.segments+=new Set(edges.map(e=>e.segment)).size;
  for(const e of edges){hash.update(JSON.stringify(e)+'\n');if(e.direction==='F')stats.forwardEdges++;else stats.reverseEdges++;degree.set(e.fromNode,(degree.get(e.fromNode)||0)+1);degree.set(e.toNode,(degree.get(e.toNode)||0)+1);union(e.fromNode,e.toNode);}
  if(onBatch){batch.push(...edges);if(batch.length>=1000){await onBatch(batch);batch=[];}}
 }
 if(onBatch&&batch.length)await onBatch(batch);
 stats.uniqueNodes=parent.size;stats.sharedNodes=[...degree.values()].filter(x=>x>2).length;
 const components=new Map();for(const n of parent.keys()){const r=root(n);components.set(r,(components.get(r)||0)+1);}stats.components=components.size;for(const count of components.values())if(count>stats.largestComponentNodes)stats.largestComponentNodes=count;
 return {stats,fingerprint:hash.digest('hex')};
}
function assertExpected(stats){for(const [k,v] of Object.entries(EXPECTED))if(stats[k]!==v)throw Error(`Preflight mismatch ${k}: ${stats[k]} != ${v}`);}
async function main(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 if(write&&process.env.JALAN_V495_GRAPH_CONFIRM!==`${DB}.${TARGET}`)throw Error(`Write blocked: set JALAN_V495_GRAPH_CONFIRM=${DB}.${TARGET}`);
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
  if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;
  const [roads,restrictions,quarantine]=await Promise.all([db.collection(SOURCE).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
  if(roads!==EXPECTED.roads||restrictions!==EXPECTED.restrictions||quarantine!==EXPECTED.quarantine)throw Error(`Source counts changed: ${roads}/${restrictions}/${quarantine}`);
  if(write&&await db.collection(TARGET).countDocuments())throw Error('Target not empty; no overwrite supported. Investigate before retry.');
  const preflight=await scan(db);assertExpected(preflight.stats);
  console.log(JSON.stringify({ok:true,mode:'PREFLIGHT_PASSED',database:DB,source:SOURCE,target:TARGET,stats:preflight.stats,sourceFingerprint:preflight.fingerprint,databaseWrites:0},null,2));
  if(!write){console.log('DRY RUN: graph not persisted.');return;}
  // Build indexes on the empty isolated target before writing. No source collections are modified.
  const target=db.collection(TARGET);
  await target.createIndex({edgeId:1},{unique:true});await target.createIndex({fromNode:1});await target.createIndex({toNode:1});await target.createIndex({regionKey:1,roadId:1});
  const indexes=await target.listIndexes().toArray();
  for(const name of ['edgeId_1','fromNode_1','toNode_1','regionKey_1_roadId_1'])if(!indexes.some(x=>x.name===name))throw Error('Missing index: '+name);
  const unique=indexes.find(x=>x.name==='edgeId_1');if(!unique?.unique)throw Error('edgeId index is not unique');
  if(await target.countDocuments())throw Error('Target changed before write');
  let inserted=0;
  const written=await scan(db,{onBatch:async batch=>{const r=await target.insertMany(batch,{ordered:true});inserted+=Object.keys(r.insertedIds).length;}});
  const persisted=await target.countDocuments();
  const consistent=written.fingerprint===preflight.fingerprint&&JSON.stringify(written.stats)===JSON.stringify(preflight.stats);
  const ok=consistent&&persisted===EXPECTED.directedEdges&&inserted===EXPECTED.directedEdges;
  console.log(JSON.stringify({ok,mode:ok?'WRITE_COMPLETE':'WRITE_VERIFICATION_FAILED',database:DB,target:TARGET,stats:written.stats,persistedEdges:persisted,insertedEdges:inserted,sourceFingerprint:written.fingerprint,sourceUnchangedDuringPasses:consistent,indexesVerified:true,graphPersisted:persisted>0,turnRestrictionsEnforced:false,routingActivated:false,note:'Non-transactional import; if interrupted, do not rerun blindly. Inspect partial target first.'},null,2));
  if(!ok)process.exitCode=2;
 }finally{await conn.close();}
}
if(require.main===module)main().catch(e=>{console.error('GRAPH BUILD FAILED:',e.message);process.exitCode=1;});
module.exports={accessAllowed,direction,edgesForRoad,scan};
