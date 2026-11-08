'use strict';
// Jalan V4.9.5: isolated directed-edge graph. Dry run by default.
require('dotenv').config();
const mongoose=require('mongoose');
const DB='jalan_navigation', SOURCE='road_network_v493', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493', TARGET='road_graph_edges_v495';
const args=process.argv.slice(2);const write=args.includes('--write');
if(args.some(x=>x!=='--write')){console.error('Usage: node scripts/build-graph-v495.js [--write]');process.exit(1);}
const blocked=new Set(['no','private','agricultural','forestry']);
function accessAllowed(r){return ![r.access,r.motorVehicle,r.vehicle].some(v=>blocked.has(String(v||'').toLowerCase()));}
function direction(r){const d=String(r.onewayDirection||'').toLowerCase();if(['-1','reverse','backward'].includes(d))return 'reverse';if(r.oneway||['yes','1','true','forward'].includes(d))return 'forward';return 'both';}
function edgesForRoad(r){const ids=r.nodeIds||[],pts=r.geometry?.coordinates||[];if(ids.length<2||ids.length!==pts.length)throw Error('Bad node/coordinate alignment: '+r.roadId);
 const dir=direction(r),result=[];
 for(let i=1;i<ids.length;i++){
  const a=ids[i-1],b=ids[i],p=pts[i-1],q=pts[i];
  if(a===b)continue;
  if(![...p,...q].every(Number.isFinite))throw Error('Bad coordinates: '+r.roadId);
  const base={roadId:r.roadId,segment:i-1,highway:r.highway||'',regionKey:r.regionKey||'',layer:r.layer??null,bridge:r.bridge||'',tunnel:r.tunnel||'',access:r.access||'',motorVehicle:r.motorVehicle||'',vehicle:r.vehicle||'',sourceVersion:r.sourceVersion||''};
  if(dir!=='reverse')result.push({...base,edgeId:`${r.roadId}:${i-1}:F`,fromNode:String(a),toNode:String(b),coordinates:[p,q],direction:'F'});
  if(dir!=='forward')result.push({...base,edgeId:`${r.roadId}:${i-1}:R`,fromNode:String(b),toNode:String(a),coordinates:[q,p],direction:'R'});
 }
 return result;
}
async function main(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 if(write&&process.env.JALAN_V495_GRAPH_CONFIRM!==`${DB}.${TARGET}`)throw Error('Write blocked: set JALAN_V495_GRAPH_CONFIRM='+DB+'.'+TARGET);
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
  if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;
  const [roads,restrictions,quarantine]=await Promise.all([db.collection(SOURCE).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
  if(roads!==31525||restrictions!==1941||quarantine!==45)throw Error(`Source counts changed: ${roads}/${restrictions}/${quarantine}`);
  if(write&&await db.collection(TARGET).countDocuments())throw Error('Target not empty. No overwrite supported; investigate first.');
  const stats={roads,restrictions,quarantine,eligibleRoads:0,excludedRoads:0,segments:0,directedEdges:0,forwardEdges:0,reverseEdges:0,invalidRoads:0,sharedNodes:0,uniqueNodes:0,components:0,largestComponentNodes:0};
  const parent=new Map(),size=new Map(),degree=new Map();
  function root(x){if(!parent.has(x)){parent.set(x,x);size.set(x,1);}let p=x;while(parent.get(p)!==p){p=parent.get(p);}while(parent.get(x)!==x){const y=parent.get(x);parent.set(x,p);x=y;}return p;}
  function union(a,b){let x=root(a),y=root(b);if(x===y)return;if(size.get(x)<size.get(y))[x,y]=[y,x];parent.set(y,x);size.set(x,size.get(x)+size.get(y));}
  let batch=[];async function flush(){if(!write||!batch.length){batch=[];return;}await db.collection(TARGET).insertMany(batch,{ordered:true});batch=[];}
  for await(const r of db.collection(SOURCE).find({},{projection:{roadId:1,nodeIds:1,geometry:1,oneway:1,onewayDirection:1,highway:1,regionKey:1,layer:1,bridge:1,tunnel:1,access:1,motorVehicle:1,vehicle:1,sourceVersion:1}}).batchSize(200)){
   if(!accessAllowed(r)){stats.excludedRoads++;continue;}
   let edges;try{edges=edgesForRoad(r);}catch(e){stats.invalidRoads++;if(stats.invalidRoads<4)console.error(e.message);continue;}
   stats.eligibleRoads++;stats.directedEdges+=edges.length;
   for(const e of edges){if(e.direction==='F')stats.forwardEdges++;else stats.reverseEdges++;degree.set(e.fromNode,(degree.get(e.fromNode)||0)+1);degree.set(e.toNode,(degree.get(e.toNode)||0)+1);union(e.fromNode,e.toNode);}
   stats.segments+=new Set(edges.map(e=>e.segment)).size;
   if(write){batch.push(...edges);if(batch.length>=1000)await flush();}
  }
  if(stats.invalidRoads)throw Error('Refusing graph: invalid road alignment');
  await flush();stats.uniqueNodes=parent.size;stats.sharedNodes=[...degree.values()].filter(x=>x>2).length;
  const components=new Map();for(const n of parent.keys()){const r=root(n);components.set(r,(components.get(r)||0)+1);}stats.components=components.size;for(const count of components.values())if(count>stats.largestComponentNodes)stats.largestComponentNodes=count;
  const persisted=write?await db.collection(TARGET).countDocuments():0;
  if(write){if(persisted!==stats.directedEdges)throw Error(`Edge count mismatch ${persisted} vs ${stats.directedEdges}`);
   await db.collection(TARGET).createIndex({edgeId:1},{unique:true});await db.collection(TARGET).createIndex({fromNode:1});await db.collection(TARGET).createIndex({toNode:1});await db.collection(TARGET).createIndex({regionKey:1,roadId:1});
  }
  console.log(JSON.stringify({ok:true,mode:write?'WRITE_COMPLETE':'DRY_RUN',database:DB,source:SOURCE,target:TARGET,stats,persistedEdges:persisted,graphPersisted:write,turnRestrictionsEnforced:false,accessPolicy:'conservative tag exclusion; not a complete legal vehicle-access evaluator',routingActivated:false,notes:['Edges use shared OSM node IDs, not grade-tag equality.','Graph component counts are undirected diagnostics, not proof of routability.','No turn restrictions, barriers, conditional access or live routing are enforced.','Source V4.9.3 collections and live traffic are not modified.']},null,2));
 }finally{await conn.close();}
}
if(require.main===module)main().catch(e=>{console.error('GRAPH BUILD FAILED:',e.message);process.exitCode=1;});
module.exports={accessAllowed,direction,edgesForRoad};
