'use strict';
// Read-only integration prototype. NOT a legal/production navigation engine.
require('dotenv').config();
const mongoose=require('mongoose');
const {meters,Heap}=require('./test-routes-v496');
const {bearing,maneuver,match}=require('./test-jalan-batch2');
const DB='jalan_navigation', EDGES='road_graph_edges_v495', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--self-test')){console.error('Usage: node scripts/test-jalan-batch2-implementation.js [--self-test]');process.exit(1);}
const id=v=>String(v??'');
function indexRestrictions(records){
 const byNode=new Map();let supported=0,unsupported=0;
 for(const r of records){
  const viaNodes=r.viaNodes||[],viaWays=r.viaWays||[];
  const type=id(r.restriction).toLowerCase();
  if(viaWays.length||viaNodes.length!==1||r.conditional||!r.fromWay||!r.toWay||(!type.startsWith('no_')&&!type.startsWith('only_'))){unsupported++;continue;}
  const n=id(viaNodes[0]);if(!byNode.has(n))byNode.set(n,[]);byNode.get(n).push(r);supported++;
 }
 return {byNode,supported,unsupported};
}
function permitted(prevEdge,nextEdge,node,idx){
 if(!prevEdge)return true;
 for(const r of idx.byNode.get(node)||[]){
  if(id(r.fromWay)!==prevEdge.roadId)continue;
  const target=id(r.toWay)===nextEdge.roadId;
  const type=id(r.restriction).toLowerCase();
  if(type.startsWith('no_')&&target)return false;
  if(type.startsWith('only_')&&!target)return false;
 }
 return true;
}
function shortest(adj,from,to,idx,limit=150000){
 // State includes previous edge: node-only Dijkstra cannot enforce turn restrictions.
 const heap=new Heap(),best=new Map(),previous=new Map(),stateKey=(n,e)=>n+'|'+(e?.edgeId||'START');
 const start=stateKey(from,null);best.set(start,0);heap.push({node:from,edge:null,cost:0,key:start});let visited=0,blockedTurns=0;
 while(heap.length){const cur=heap.pop();if(cur.cost!==best.get(cur.key))continue;visited++;
  if(cur.node===to){const edges=[];let key=cur.key;while(key!==start){const p=previous.get(key);if(!p)throw Error('Broken route predecessor');edges.push(p.edge);key=p.from;}edges.reverse();return {found:true,visited,blockedTurns,distanceMeters:Math.round(cur.cost),edges};}
  if(visited>=limit)return {found:false,reason:'search-limit',visited,blockedTurns};
  for(const e of adj.get(cur.node)||[]){if(!permitted(cur.edge,e,cur.node,idx)){blockedTurns++;continue;}
   const cost=cur.cost+e.distance,key=stateKey(e.toNode,e);
   if(cost<(best.get(key)??Infinity)){best.set(key,cost);previous.set(key,{from:cur.key,edge:e});heap.push({node:e.toNode,edge:e,cost,key});}
  }
 }
 return {found:false,reason:'unreachable',visited,blockedTurns};
}
function instructions(edges){const result=[];for(let i=1;i<edges.length;i++){
 const a=edges[i-1],b=edges[i];if(a.toNode!==b.fromNode)throw Error('Discontinuous route');
 if(a.roadId===b.roadId)continue;
 const m=maneuver(a.coordinates[0],a.coordinates[1],b.coordinates[1]);
 result.push({atNode:a.toNode,fromRoad:a.roadId,toRoad:b.roadId,instruction:m.instruction,angle:m.deltaDegrees});
 }return result;}
function report(mode,checks,extra){const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({ok:passed===checks.length,mode,passed,total:checks.length,tests:checks,...extra,databaseWrites:0,routingActivated:false,legalDrivingRouteVerified:false},null,2));if(passed!==checks.length)process.exitCode=2;}
function selfTest(){
 const e=(edgeId,roadId,fromNode,toNode,coordinates,distance)=>({edgeId,roadId,fromNode,toNode,coordinates,distance});
 const A=e('a','osm-way-1','A','B',[[101.7,3.1],[101.7,3.101]],10),B=e('b','osm-way-2','B','C',[[101.7,3.101],[101.701,3.101]],10),C=e('c','osm-way-3','B','D',[[101.7,3.101],[101.699,3.101]],10),D=e('d','osm-way-4','D','C',[[101.699,3.101],[101.701,3.101]],25);
 const adj=new Map([['A',[A]],['B',[B,C]],['D',[D]]]);
 const none=indexRestrictions([]),no=indexRestrictions([{restrictionId:'x',restriction:'no_right_turn',fromWay:'osm-way-1',toWay:'osm-way-2',viaNodes:['B'],viaWays:[]}]);
 const only=indexRestrictions([{restrictionId:'y',restriction:'only_right_turn',fromWay:'osm-way-1',toWay:'osm-way-2',viaNodes:['B'],viaWays:[]}]);
 const viaWay=indexRestrictions([{restrictionId:'z',restriction:'no_left_turn',fromWay:'osm-way-1',toWay:'osm-way-2',viaNodes:[],viaWays:['osm-way-3']}]);
 const normal=shortest(adj,'A','C',none),detour=shortest(adj,'A','C',no),onlyRoute=shortest(adj,'A','C',only);
 const gps=match([101.7005,3.101],[B,{...B,edgeId:'reverse',coordinates:[...B.coordinates].reverse()}],90);
 const checks=[
  {name:'baseline direct route',pass:normal.found&&normal.edges.map(e=>e.edgeId).join(',')==='a,b'},
  {name:'no-turn forces detour',pass:detour.found&&detour.edges.map(e=>e.edgeId).join(',')==='a,c,d'&&detour.blockedTurns>0},
  {name:'only-turn excludes other exit',pass:!permitted(A,C,'B',only)&&onlyRoute.found},
  {name:'via-way not falsely enforced',pass:viaWay.supported===0&&viaWay.unsupported===1},
  {name:'route maneuver from real edge chain',pass:instructions(normal.edges).length===1&&instructions(normal.edges)[0].instruction==='right'},
  {name:'GPS heading selects forward edge',pass:gps?.edgeId==='b'},
  {name:'disconnected destination rejected',pass:!shortest(adj,'C','A',none).found},
  {name:'search bound respected',pass:shortest(adj,'A','C',none,1).reason==='search-limit'}
 ];report('BATCH2_IMPLEMENTATION_SYNTHETIC',checks,{syntheticOnly:true,coverage:'via-node no_ and only_ restrictions only'});
}
async function database(){if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;const [ec,rc,qc]=await Promise.all([db.collection(EDGES).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);if(ec!==168221||rc!==1941||qc!==45)throw Error('Source counts changed; refusing test');
 const records=await db.collection(RESTR).find({}).toArray(),idx=indexRestrictions(records),adj=new Map();let sample=null,loaded=0;
 for await(const d of db.collection(EDGES).find({},{projection:{_id:0,edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1}}).batchSize(500)){
  if(!d.edgeId||!d.roadId||!d.fromNode||!d.toNode||d.coordinates?.length!==2)throw Error('Invalid stored edge');d.distance=meters(d.coordinates[0],d.coordinates[1]);if(!Number.isFinite(d.distance))throw Error('Invalid edge distance');
  if(!adj.has(d.fromNode))adj.set(d.fromNode,[]);adj.get(d.fromNode).push(d);if(!sample)sample=d;loaded++;
 }
 const route=shortest(adj,sample.fromNode,sample.toNode,idx),turns=route.found?instructions(route.edges):[];
 const midpoint=sample.coordinates[0].map((x,i)=>(x+sample.coordinates[1][i])/2);
 const near=match(midpoint,(adj.get(sample.fromNode)||[]).slice(0,50),bearing(sample.coordinates[0],sample.coordinates[1]));
 const checks=[
 {name:'all graph edges loaded',pass:loaded===168221},
 {name:'restriction records classified',pass:idx.supported+idx.unsupported===1941},
 {name:'actual directed route found',pass:route.found&&route.edges.length>=1},
 {name:'actual route edge continuity',pass:route.found&&route.edges.every((e,i)=>i===0||route.edges[i-1].toNode===e.fromNode)},
 {name:'actual route instructions pipeline runs',pass:Array.isArray(turns)},
 {name:'actual GPS nearest-edge sample',pass:!!near&&Number.isFinite(near.distanceMeters)}
 ];
 report('BATCH2_IMPLEMENTATION_DATABASE',checks,{database:DB,counts:{edges:ec,restrictions:rc,quarantine:qc},restrictionCoverage:{supportedViaNode:idx.supported,unsupported:idx.unsupported},routeSample:{fromNode:sample.fromNode,toNode:sample.toNode,found:route.found,distanceMeters:route.distanceMeters,edgeCount:route.edges?.length,blockedTurns:route.blockedTurns,instructions:turns.slice(0,5)},gpsSample:near,caveats:['Only simple via-node no_/only_ restrictions applied; via-way and conditional rules not enforced.','No barrier, time-dependent access, legal road validation, production GPS matching, or live navigation.','Database test uses a short actual graph route; cross-city coverage remains unverified.']});
 }finally{await conn.close();}}
if(require.main===module)(args.includes('--self-test')?Promise.resolve().then(selfTest):database()).catch(e=>{console.error('BATCH2 IMPLEMENTATION FAILED:',e.message);process.exitCode=1;});
module.exports={indexRestrictions,permitted,shortest,instructions};
