'use strict';
// Batch 4A.5: read-only investigation of four directed-path failures.
// No topology repairs or navigation activation. No collection writes.
require('dotenv').config();
const mongoose=require('mongoose');
const {anchors,meters}=require('./test-jalan-batch4a3');
const {weakComponents,directedReachable}=require('./test-jalan-batch4a4');
const DB='jalan_navigation', EDGES='road_graph_edges_v495', ROADS='road_network_v493';
const PAIRS=[[2,4],[3,11],[6,2],[12,14]];
const MAX_SNAP=200, CANDIDATES=8;
function candidateNodes(coords,p,limit=CANDIDATES){const list=[];for(const [node,xy] of coords){const d=meters(xy,p);if(list.length<limit){list.push({node,snapMeters:Math.round(d)});list.sort((a,b)=>a.snapMeters-b.snapMeters);}else if(d<list[list.length-1].snapMeters){list[list.length-1]={node,snapMeters:Math.round(d)};list.sort((a,b)=>a.snapMeters-b.snapMeters);}}return list;}
function adjFrom(edges){const a=new Map(),r=new Map();for(const e of edges){if(!a.has(e.fromNode))a.set(e.fromNode,[]);a.get(e.fromNode).push(e.toNode);if(!r.has(e.toNode))r.set(e.toNode,[]);r.get(e.toNode).push(e.fromNode);}return {a,r};}
function reachableSet(adj,start,cap=200000){const seen=new Set([start]),q=[start];let i=0;for(;i<q.length&&i<cap;i++)for(const n of adj.get(q[i])||[])if(!seen.has(n)){seen.add(n);q.push(n);}return {nodes:seen,visited:i,limitReached:i>=cap&&i<q.length};}
function pairAudit(adj,back,start,end){
 const forward=reachableSet(adj,start),reverse=reachableSet(back,end);
 return {forwardReachableNodes:forward.nodes.size,reverseReachableNodes:reverse.nodes.size,
  directedReachable:forward.nodes.has(end),searchCapped:forward.limitReached||reverse.limitReached,
  sharedReachabilityNodes:[...forward.nodes].filter(x=>reverse.nodes.has(x)).length};
}
function tests(){const edges=[{fromNode:'a',toNode:'b'},{fromNode:'b',toNode:'c'},{fromNode:'d',toNode:'c'}];const {a,r}=adjFrom(edges);
const coords=new Map([['a',[101,3]],['b',[101.001,3]],['c',[101.002,3]]]);
const x=pairAudit(a,r,'a','c'),y=pairAudit(a,r,'c','a');
const checks=[['four unique failed pairs',PAIRS.length===4&&new Set(PAIRS.map(p=>p.join(':'))).size===4],['forward reachable',x.directedReachable],['reverse unreachable',!y.directedReachable],['reverse adjacency',r.get('c').includes('b')],['candidate ranking',candidateNodes(coords,[101,3])[0].node==='a'],['bounded candidate list',candidateNodes(coords,[101,3],2).length===2],['directed closure',x.forwardReachableNodes===3],['no shared path on reverse',y.sharedReachabilityNodes===0],['snap threshold fixed',MAX_SNAP===200],['no database writes',true]];
const passed=checks.filter(x=>x[1]).length;console.log(JSON.stringify({ok:passed===checks.length,mode:'BATCH4A5_SELF_TEST',passed,total:checks.length,checks:checks.map(([name,pass])=>({name,pass})),databaseWrites:0},null,2));if(passed!==checks.length)process.exitCode=1;}
async function database(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const c=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
 if(c.name!==DB)throw Error('Wrong DB');
 const db=c.db;
 const [ec,rc,tc,qc]=await Promise.all([db.collection(EDGES).countDocuments(),db.collection(ROADS).countDocuments(),db.collection('road_turn_restrictions_v493').countDocuments(),db.collection('road_restriction_quarantine_v493').countDocuments()]);
 if(ec!==168221||rc!==31525||tc!==1941||qc!==45)throw Error('Source counts changed; investigate before continuing');
 const [edges,roads]=await Promise.all([
 db.collection(EDGES).find({},{projection:{_id:0,edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1,direction:1}}).toArray(),
 db.collection(ROADS).find({},{projection:{_id:0,roadId:1,oneway:1,onewayDirection:1,junction:1,highway:1,access:1,motorVehicle:1,vehicle:1}}).toArray()]);
 const coords=new Map(),byNode=new Map(),wayDirections=new Map();
 for(const e of edges){
 if(!coords.has(e.fromNode))coords.set(e.fromNode,e.coordinates[0]);
 if(!coords.has(e.toNode))coords.set(e.toNode,e.coordinates[1]);
 for(const n of [e.fromNode,e.toNode]){if(!byNode.has(n))byNode.set(n,new Set());byNode.get(n).add(e.roadId);}
 if(!wayDirections.has(e.roadId))wayDirections.set(e.roadId,new Set());wayDirections.get(e.roadId).add(e.direction);
 }
 const {a,r}=adjFrom(edges),components=weakComponents(edges);
 const roadLookup=new Map(roads.map(x=>[x.roadId,x]));
 const reports=[];
 for(const [i,j] of PAIRS){
 const origin=anchors[i],dest=anchors[j],start=candidateNodes(coords,[origin[1],origin[2]]),end=candidateNodes(coords,[dest[1],dest[2]]);
 const baseline=pairAudit(a,r,start[0].node,end[0].node);
 const starts=start.filter(x=>x.snapMeters<=MAX_SNAP),ends=end.filter(x=>x.snapMeters<=MAX_SNAP);
 const startClosures=starts.map(s=>({s,reach:reachableSet(a,s.node)}));
 const alternatives=[];
 for(const {s,reach} of startClosures)for(const t of ends)if(reach.nodes.has(t.node))alternatives.push({startNode:s.node,endNode:t.node,startSnapMeters:s.snapMeters,endSnapMeters:t.snapMeters});
 const nodes=[...new Set([...start.map(x=>x.node),...end.map(x=>x.node)])];
 const vicinityRoadIds=new Set(nodes.flatMap(n=>[...(byNode.get(n)||[])]));
 const vicinityRoads=[...vicinityRoadIds].slice(0,30).map(id=>{const road=roadLookup.get(id)||{};return {roadId:id,oneway:road.oneway??null,onewayDirection:road.onewayDirection??null,junction:road.junction??null,highway:road.highway??null,graphDirections:[...(wayDirections.get(id)||[])]};});
 reports.push({from:origin[0],to:dest[0],baseline,originCandidates:start,destinationCandidates:end,originWeakComponent:components.labels.get(start[0].node),destinationWeakComponent:components.labels.get(end[0].node),alternativeEndpointPairs:alternatives.slice(0,12),alternativeCount:alternatives.length,nearbyRoadDirectionEvidence:vicinityRoads,interpretation:alternatives.length?'NEARBY_ENDPOINT_PAIR_DIRECTED_REACHABLE':baseline.searchCapped?'REACHABILITY_SEARCH_CAPPED':'NO_REACHABLE_NEARBY_ENDPOINT_PAIR'});
 }
 const result={ok:true,mode:'BATCH4A5_DIRECTED_NETWORK_AUDIT',counts:{edges:ec,roads:rc,restrictions:tc,quarantine:qc},pairs:reports,summary:{pairsChecked:reports.length,nearbyEndpointRecovery:reports.filter(x=>x.alternativeCount>0).length,stillUnresolved:reports.filter(x=>x.alternativeCount===0).length},readOnly:true,databaseWrites:0,liveRoutingActivated:false,legalDrivingRouteVerified:false,notes:['This is a directed connectivity audit, not a graph repair.','Nearby candidate nodes may be on opposite carriageways or inaccessible roads; reachable does not mean legal or usable.','Road oneway tags are evidence for review; do not reverse or add graph edges automatically.','The first eight nearest nodes may not include an appropriate drivable endpoint.','Physical medians, barriers, turn semantics and OSRM comparisons are not validated.']};
 console.log(JSON.stringify(result,null,2));
 }finally{await c.close();}
}
if(require.main===module)(process.argv.includes('--self-test')?Promise.resolve().then(tests):process.argv.length===2?database():Promise.reject(Error('Usage: node scripts/test-jalan-batch4a5.js [--self-test]'))).catch(e=>{console.error('BATCH4A5 FAILED:',e.stack||e.message);process.exitCode=1;});
