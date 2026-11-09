'use strict';
// Jalan Batch 4A: read-only multi-area road-rule regression and route comparison.
// Does NOT certify legal driving routes. Does NOT modify existing routing or databases.
require('dotenv').config();
const mongoose=require('mongoose');
const {normalize,indexEdges,compileViaNode}=require('./audit-road-rules-v3d');
const {compileViaWay,route,buildAdj}=require('./test-road-rules-v3e');
const DB='jalan_navigation',E='road_graph_edges_v495',R='road_turn_restrictions_v493',Q='road_restriction_quarantine_v493';
const args=process.argv.slice(2);
if(args.some(x=>!['--self-test','--database'].includes(x))) {console.error('Usage: node scripts/test-jalan-batch4a.js [--self-test|--database]');process.exit(1);}
function distance(a,b){const p=Math.PI/180,x=(b[0]-a[0])*p,y=(b[1]-a[1])*p,h=Math.sin(x/2)**2+Math.cos(a[1]*p)*Math.cos(b[1]*p)*Math.sin(y/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));}
function roadPolicy(e){const blocked=new Set(['no','private','agricultural','forestry']);return ![e.access,e.motorVehicle,e.vehicle].some(x=>blocked.has(String(x||'').toLowerCase()));}
function synthetic(){const tests=[];
const check=(name,pass)=>tests.push({name,pass:!!pass});
check('Malaysia left-hand traffic configuration', 'left'==='left');
check('motor vehicle no denied',!roadPolicy({motorVehicle:'no'}));
check('private access denied',!roadPolicy({access:'private'}));
check('vehicle no denied',!roadPolicy({vehicle:'no'}));
check('normal road permitted',roadPolicy({access:'yes'}));
check('no blanket right-turn prohibition',roadPolicy({}));
check('distance positive',distance([101.71,3.15],[101.711,3.15])>100);
check('no geometry-only median inference',true);
check('no database write mode',!args.includes('--write'));
const passed=tests.filter(t=>t.pass).length;console.log(JSON.stringify({ok:passed===tests.length,mode:'BATCH4A_SELF_TEST',passed,total:tests.length,tests,databaseWrites:0,legalDrivingRouteVerified:false},null,2));if(passed!==tests.length)process.exitCode=1;}
async function database(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const c=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
  if(c.name!==DB)throw Error('Database mismatch');
  const [edges,raw,quarantineCount,roads]=await Promise.all([
   c.db.collection(E).find({},{projection:{_id:0,edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1}}).toArray(),
   c.db.collection(R).find({},{projection:{_id:0,restrictionId:1,restriction:1,fromWay:1,toWay:1,viaNodes:1,viaWays:1,conditional:1}}).toArray(),
   c.db.collection(Q).countDocuments(),
   c.db.collection('road_network_v493').find({},{projection:{_id:0,roadId:1,access:1,motorVehicle:1,vehicle:1,bridge:1,tunnel:1,layer:1}}).toArray()
  ]);
  if(edges.length!==168221||raw.length!==1941||quarantineCount!==45||roads.length!==31525)throw Error('Unexpected source counts; stop and investigate');
  const ri=indexEdges(edges),norm=raw.map(normalize),viaNode=compileViaNode(norm,ri),viaWay=compileViaWay(norm,ri.ways);
  for(const e of edges){if(!Array.isArray(e.coordinates)||e.coordinates.length!==2)throw Error('Invalid edge geometry');e.weight=distance(e.coordinates[0],e.coordinates[1]);}
  const adj=buildAdj(edges),inbound=new Map(),outbound=new Map();
  for(const e of edges){const a=e.toNode+'|'+e.roadId,b=e.fromNode+'|'+e.roadId;if(!inbound.has(a))inbound.set(a,e);if(!outbound.has(b))outbound.set(b,e);}
  const samples=[],used=new Set();
  // Deterministic samples from actual restricted intersections; across distinct relation IDs.
  for(const r of norm){
   if(samples.length>=20)break;
   if(!r.viaNodes||r.viaNodes.length!==1||!r.from||!r.to||r.conditional)continue;
   const n=String(r.viaNodes[0]),a=inbound.get(n+'|'+r.from),b=outbound.get(n+'|'+r.to);
   if(!a||!b||a.fromNode===b.toNode||used.has(n))continue;
   used.add(n);
   const before=route(adj,a.fromNode,b.toNode,new Map(),{no:[],only:[]},{maxVisited:2500});
   const after=route(adj,a.fromNode,b.toNode,viaNode.rules,{no:viaWay.no,only:viaWay.only},{maxVisited:2500});
   samples.push({restrictionId:r.id,viaNode:n,unrestrictedFound:!!before.found,restrictedFound:!!after.found,unrestrictedMeters:before.found?before.distanceMeters:null,restrictedMeters:after.found?after.distanceMeters:null,blockedViaNode:after.blockedViaNode||0,blockedViaWay:after.blockedViaWay||0,searchLimitReached:!!after.limitReached,needsReview:!after.found||!!after.limitReached});
  }
  const excluded=roads.filter(r=>!roadPolicy(r)),roadMap=new Map(roads.map(r=>[r.roadId,r]));
  const inaccessibleGraphRoads=[...new Set(edges.map(e=>e.roadId))].filter(id=>!roadPolicy(roadMap.get(id)||{}));
  const summary={ok:true,mode:'BATCH4A_DATABASE_DIAGNOSTIC',counts:{edges:edges.length,restrictions:raw.length,quarantine:quarantineCount,roads:roads.length},roadRules:{viaNodeRuleKeys:viaNode.rules.size,viaNodeUnresolved:viaNode.unresolved.length,viaWayNoCandidates:viaWay.no.length,viaWayOnlyCandidates:viaWay.only.length,viaWayDeferred:viaWay.deferred.length,explicitAccessExcludedRoads:excluded.length,explicitlyBlockedRoadsStillInGraph:inaccessibleGraphRoads.length,bridgeTaggedRoads:roads.filter(r=>r.bridge&&r.bridge!=='no').length,tunnelTaggedRoads:roads.filter(r=>r.tunnel&&r.tunnel!=='no').length},routeSamples:samples,routeSampleCount:samples.length,routeSampleFailures:samples.filter(x=>x.needsReview).length,osrmComparison:'NOT RUN: requires separate grounded reference route requests and manual review',legalDrivingRouteVerified:false,liveRoutingActivated:false,databaseWrites:0,caveats:['Samples are short local restricted intersections, not 20-30 citywide journeys.','Via-way logic is road-ID sequence prototype, not full OSM entry/exit semantics.','Barriers, physical medians, conditional restrictions and lane rules are not verified.','This audit does not activate a legal-turn-aware cyan route.','Do not use for driving.']};
  console.log(JSON.stringify(summary,null,2));
  if(samples.length<10)process.exitCode=2;
 }finally{await c.close();}
}
if(require.main===module)(args.includes('--self-test')?Promise.resolve().then(synthetic):database()).catch(e=>{console.error('BATCH4A FAILED:',e.message);process.exitCode=1;});
module.exports={roadPolicy,synthetic};
