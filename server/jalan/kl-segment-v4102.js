'use strict';
// Jalan Batch 3C: isolated, read-only segment-snap preview with direction-aware partial edges.
const express=require('express'),mongoose=require('mongoose');
const {auditTurnCandidates}=require('./kl-turn-audit-v4102');
const {auditViaWayPathCandidates}=require('./kl-via-way-audit-v4102');
const {auditPathGeometryGaps}=require('./kl-path-geometry-audit-v4102');
const {createEdgeIdGuard}=require('./kl-edge-identity-v4102');
const {auditGraphNodeGeometry}=require('./kl-node-geometry-audit-v4102');
const {auditRoutePlausibility}=require('./kl-route-plausibility-audit-v4102');
const {auditDirectedGraphTopology}=require('./kl-graph-topology-audit-v4102');
const {auditStrongComponents}=require('./kl-strong-components-audit-v4102');
const router=express.Router(),DB='jalan_navigation',COL='road_graph_edges_v495',COUNT=168221,R=6371000;
let graph=null,loading=null;
const rad=Math.PI/180;
function distance(a,b){const x=(b[0]-a[0])*rad,y=(b[1]-a[1])*rad,h=Math.sin(x/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function project(p,a,b){const scale=Math.cos(p[0]*rad),ax=(a[1]-p[1])*scale,ay=a[0]-p[0],dx=(b[1]-a[1])*scale,dy=b[0]-a[0];const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return {point,t,meters:distance(p,point)};}
// Read-only access caution for OSM-tagged roads. This is diagnostic only:
// destination/customer/permit restrictions depend on trip purpose and legal context.
const ACCESS_CAUTION=new Set(['destination','customers','permit','private','no','delivery']);
function accessCaution(e){return [e.access,e.vehicle,e.motorVehicle].some(v=>ACCESS_CAUTION.has(String(v||'').toLowerCase()));}
function pilot(p){return p.every(Number.isFinite)&&p[0]>=2.5&&p[0]<=3.8&&p[1]>=100.8&&p[1]<=102.3;}
class Heap{constructor(){this.a=[];}push(x){const a=this.a;let i=a.length;a.push(x);while(i){const j=(i-1)>>1;if(a[j].d<=x.d)break;a[i]=a[j];i=j;}a[i]=x;}pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1].d<a[j].d)j++;if(a[j].d>=last.d)break;a[i]=a[j];i=j;}a[i]=last;}return first;}}
async function load(){if(graph)return graph;if(loading)return loading;loading=(async()=>{const col=mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL);if(await col.countDocuments()!==COUNT)throw Error('Graph count mismatch');const adj=new Map(),edges=[],accessMetadata=new Map(),edgeIds=createEdgeIdGuard();for await(const e of col.find({},{projection:{edgeId:1,fromNode:1,toNode:1,coordinates:1,access:1,vehicle:1,motorVehicle:1}}).batchSize(1000)){if(!e.edgeId||!e.fromNode||!e.toNode||!Array.isArray(e.coordinates)||e.coordinates.length!==2)throw Error('Invalid edge');edgeIds.record(e.edgeId);const a=[e.coordinates[0][1],e.coordinates[0][0]],b=[e.coordinates[1][1],e.coordinates[1][0]];if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('Invalid geometry');const edge={id:e.edgeId,from:String(e.fromNode),to:String(e.toNode),a,b,len:distance(a,b),potentialAccessCaution:accessCaution(e)};
if(edge.potentialAccessCaution)accessMetadata.set(edge.id,{
 access:ACCESS_CAUTION.has(e.access)?e.access:null,
 vehicle:ACCESS_CAUTION.has(e.vehicle)?e.vehicle:null,
 motorVehicle:ACCESS_CAUTION.has(e.motorVehicle)?e.motorVehicle:null
});
edges.push(edge);if(!adj.has(edge.from))adj.set(edge.from,[]);adj.get(edge.from).push(edge);}if(edges.length!==COUNT||edgeIds.checked!==COUNT)throw Error('Graph changed');
// Advisory-only import; a broken or incomplete restriction collection must
// never produce a misleading zero-warning result or make preview routing fail.
let turnRestrictions=null;
try{
 const turns=mongoose.connection.useDb(DB,{useCache:true}).db.collection('road_turn_restrictions_v493');
 const n=await turns.countDocuments();
 if(n<1||n>5000)throw Error('Turn relation count outside guarded range');
 const docs=await turns.find({},{projection:{_id:0,restrictionId:1,applicability:1,conditional:1,except:1,fromWay:1,restriction:1,toWay:1,viaNodes:1,viaWays:1}}).toArray();
 if(docs.length!==n)throw Error('Turn relation count changed during load');
 turnRestrictions=docs;
}catch(e){console.warn('KL turn advisory unavailable:',e.message);}
return {adj,edges,accessMetadata,turnRestrictions,...graphDiagnostics(edges)};})();try{graph=await loading;return graph;}finally{loading=null;}}
// Summaries are calculated once per isolated graph load, using no database
// writes. Weak connectivity cannot substitute for directed reachability.
function graphDiagnostics(edges){return {nodeGeometry:auditGraphNodeGeometry(edges),
 topology:auditDirectedGraphTopology(edges),strongTopology:auditStrongComponents(edges)};}
function nearest(edges,p){let best=null,second=null,candidatesWithin200=0,nearby=[];for(const e of edges){
// Evaluate the segment envelope, not endpoints alone; a long road can cross the GPS location.
if(p[0]<Math.min(e.a[0],e.b[0])-.007||p[0]>Math.max(e.a[0],e.b[0])+.007)continue;
if(p[1]<Math.min(e.a[1],e.b[1])-.007||p[1]>Math.max(e.a[1],e.b[1])+.007)continue;
const x=project(p,e.a,e.b);
if(x.meters<=200){candidatesWithin200++;nearby.push({edge:e,...x});}
if(!best||x.meters<best.meters){second=best;best={edge:e,...x};}
else if(!second||x.meters<second.meters){second={edge:e,...x};}
}
if(!best)return null;
// Preserve both legal directions only for a genuine reverse directed twin:
// same OSM end nodes reversed, coincident geometry and the same snap point.
// Merely nearby parallel streets, bridges or unrelated node IDs must NOT be
// offered as alternate snaps. This is not legal turn/access enforcement.
const reverseTwin=nearby.find(candidate=>
 candidate.edge!==best.edge&&
 candidate.edge.from===best.edge.to&&candidate.edge.to===best.edge.from&&
 distance(candidate.edge.a,best.edge.b)<=0.5&&
 distance(candidate.edge.b,best.edge.a)<=0.5&&
 distance(candidate.point,best.point)<=0.5) || null;
// Ambiguity is still reported even when the reverse-twin optimization applies.
return {...best,reverseTwin,candidatesWithin200,secondBestSnapMeters:second?second.meters:null,
 ambiguousSnap:!!second&&second.meters<=200&&second.meters-best.meters<=10};
}
function calculate(g,s,t,diagnostics=null){const START='@start',END='@end',extra=new Map();
function add(from,to,len,coords,id,potentialAccessCaution=false,graphFrom=null,graphTo=null){if(!extra.has(from))extra.set(from,[]);extra.get(from).push({to,len,coords,id,potentialAccessCaution,graphFrom,graphTo,virtualPartial:true});}
// Closest-edge order must not force a detour on a bidirectional segment.
// Reverse twins were strictly verified by nearest(); offer both legal graph
// orientations to the same Dijkstra search (not a second search or road jump).
const starts=s.reverseTwin?[s,s.reverseTwin]:[s];
const targets=t.reverseTwin?[t,t.reverseTwin]:[t];
for(const snap of starts){
 const e=snap.edge;
 add(START,e.to,e.len*(1-snap.t),[snap.point,e.b],e.id,!!e.potentialAccessCaution,e.from,e.to);
 // Exact upstream node snaps may leave on any directed outgoing edge.
 if(snap.t===0)add(START,e.from,0,[snap.point,e.a],e.id,false,e.from,e.to);
}
for(const snap of targets){
 const e=snap.edge;
 add(e.from,END,e.len*snap.t,[e.a,snap.point],e.id,!!e.potentialAccessCaution,e.from,e.to);
 // Exact downstream target node snaps may arrive via any incoming edge.
 if(snap.t===1)add(e.to,END,0,[e.b,snap.point],e.id,false,e.from,e.to);
}
// Direct same-edge travel is directional. Never join merely matching edge IDs
// or coordinates across different nodes, and never travel backwards.
for(const source of starts)for(const target of targets){
 const e=source.edge;
 if(e===target.edge&&source.t<=target.t)
  add(START,END,e.len*(target.t-source.t),[source.point,target.point],
   e.id,!!e.potentialAccessCaution,e.from,e.to);
}
const heap=new Heap(),dist=new Map([[START,0]]),prev=new Map();heap.push({n:START,d:0});let visited=0;
// A directed graph with E edges may have up to 2E distinct nodes. The former fixed
// 150,000-node guard could reject valid routes in the 168,221-edge pilot graph.
const edgeCount=g.edges.length;
const visitLimit=Math.min(400000,Math.max(150000,2*edgeCount+2));
while(heap.a.length){const cur=heap.pop();if(cur.d!==dist.get(cur.n))continue;if(++visited>visitLimit)throw Error('Search visit limit');if(cur.n===END)break;
const next=[...(extra.get(cur.n)||[])];for(const e of g.adj.get(cur.n)||[])next.push({to:e.to,len:e.len,coords:[e.a,e.b],id:e.id,potentialAccessCaution:!!e.potentialAccessCaution,graphFrom:e.from,graphTo:e.to});
for(const e of next){const nd=cur.d+e.len;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:cur.n,e});heap.push({n:e.to,d:nd});}}
}
if(diagnostics&&typeof diagnostics==='object')diagnostics.visited=visited;
if(!dist.has(END))return null;const path=[];let n=END;while(n!==START){const p=prev.get(n);if(!p||path.length>COUNT)throw Error('Path reconstruction');path.push(p.e);n=p.from;}path.reverse();const geometry=[];for(const e of path){for(const p of e.coords){const q=[p[1],p[0]],last=geometry[geometry.length-1];if(!last||last[0]!==q[0]||last[1]!==q[1])geometry.push(q);}}
if (geometry.length === 1) geometry.push([...geometry[0]]); // GeoJSON LineString requires at least two positions
// Zero-distance start/end connectors are graph plumbing, not travelled roads.
// Exclude only these *virtual* edges from warnings; retain the original path
// and every real graph edge (including zero-length imported ones) for routing.
const advisoryPath=path.filter(e=>!(e.virtualPartial&&e.len===0));
// An optional private diagnostic: identify EXACT travelled directed edges whose
// imported OSM access/vehicle/motor_vehicle tags triggered this caution count.
// Do not attach coordinates or raw GPS; no legal road-access decision is made.
const accessCautionPath=advisoryPath.filter(e=>e.potentialAccessCaution);
const accessCautionDetails=g.accessMetadata instanceof Map?
 accessCautionPath.slice(0,40).map(e=>({
  edgeId:e.id,
  ...(g.accessMetadata.get(e.id)||{access:null,vehicle:null,motorVehicle:null})
 })):null;
// Advisory only: OSM node ID connectivity can conceal displaced endpoints.
// Zero-length virtual connectors are not travelled roads for turn/access QA,
// but must remain in geometry QA: their endpoints can reveal displaced
// imported-node coordinates at a chosen origin or destination.
const geometryGapAudit=auditPathGeometryGaps(path,distance);
// Heuristic only: extreme detours or below-geodesic costs warrant manual QA.
const plausibilityAudit=auditRoutePlausibility(dist.get(END),s.point,t.point,distance);
const turnAudit=Array.isArray(g.turnRestrictions)?auditTurnCandidates(
 advisoryPath.map(e=>({id:e.id,fromNode:e.graphFrom,toNode:e.graphTo})),g.turnRestrictions):null;
// The via-way matcher flags only possible OSM relation path overlaps. Neither
// a match nor an absent match establishes road-turn legality.
const viaWayAudit=Array.isArray(g.turnRestrictions)?auditViaWayPathCandidates(
 advisoryPath.map(e=>({id:e.id,fromNode:e.graphFrom,toNode:e.graphTo})),g.turnRestrictions):null;
return {geometry,distanceMeters:Math.round(dist.get(END)),edgeCount:path.length,visited,
 ...geometryGapAudit,
 ...plausibilityAudit,
 potentialAccessReviewEdges:accessCautionPath.length,
 accessCautionDetails,accessCautionDetailsTruncated:accessCautionPath.length>40,
 advisoryEdgesInspected:advisoryPath.length,
 turnReviewAvailable:turnAudit!==null,
 potentialTurnRestrictionReviewCount:turnAudit?turnAudit.potentialTurnRestrictionReviewCount:null,
 turnReviewTransitionsInspected:turnAudit?turnAudit.transitionsInspected:null,
 turnReviewComplexRecordsUnassessed:turnAudit?turnAudit.complexRestrictionsUnassessed:null,
 turnReviewViaWayRelationsUnassessed:viaWayAudit?viaWayAudit.viaWayRelationsUnassessed:null,
 turnReviewViaWayRelationsEligible:viaWayAudit?viaWayAudit.viaWayRelationsEligible:null,
 turnReviewViaWayRelationsUnsupported:viaWayAudit?viaWayAudit.viaWayRelationsUnsupported:null,
 turnReviewViaWayPathCandidateCount:viaWayAudit?viaWayAudit.viaWayPathCandidateCount:null,
 turnReviewViaWayNoTurnCandidateCount:viaWayAudit?viaWayAudit.viaWayNoTurnCandidateCount:null,
 turnReviewViaWayOnlyDesignatedExitPatternCount:viaWayAudit?viaWayAudit.viaWayOnlyDesignatedExitPatternCount:null,
 turnReviewViaWayOnlyExitMismatchCandidateCount:viaWayAudit?viaWayAudit.viaWayOnlyExitMismatchCandidateCount:null,
 turnReviewViaWayPatternAdvisoryOnly:true};}
// GeoJSON response contract: calculate() deliberately returns raw [lng,lat]
// positions for internal use. A spread of that raw route *after* a GeoJSON
// wrapper would silently overwrite geometry and break real-route evidence.
function routeAsGeoJSON(result){
 return {...result,geometry:{type:'LineString',coordinates:result.geometry}};
}
// Strict, identifiable no-path response. The offline evidence collector must
// never mistake an unrelated application's HTTP 404 for a road disconnection.
function noPathResponse(timingMs,visitedNodes=null,graphEdges=null,graphCacheHit=null){
 return {ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',error:'No directed path found',
  timingMs,graphEdges:graphEdges===COUNT?COUNT:null,graphVersion:COL,
  // Distinguish cold-load from warm-cache no-path searches without revealing
  // graph internals or reflecting arbitrary response metadata.
  graphCacheHit:typeof graphCacheHit==='boolean'?graphCacheHit:null,
  searchVisitedNodes:Number.isSafeInteger(visitedNodes)&&visitedNodes>=0&&visitedNodes<=400000?visitedNodes:null,
  timingDiagnosticOnly:true,trafficAware:false,routingActivated:false,databaseWrites:0};
}
router.get('/health',async(req,res)=>{try{const n=await mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL).countDocuments();res.json({ok:n===COUNT,mode:'kl-segment-preview-v4.10.2',graphEdges:n,readOnly:true,graphCached:!!graph,turnReviewAvailable:!!graph&&Array.isArray(graph.turnRestrictions),nodeGeometry:graph?.nodeGeometry??null,graphTopology:graph?.topology??null,graphStrongTopology:graph?.strongTopology??null,liveRouting:false});}catch(e){res.status(503).json({ok:false,error:'Graph unavailable'});}});
router.get('/route',async(req,res)=>{try{const s=[Number(req.query.startLat),Number(req.query.startLng)],t=[Number(req.query.endLat),Number(req.query.endLng)];if(!pilot(s)||!pilot(t))return res.status(400).json({ok:false,error:'Both coordinates must be in the KL pilot region'});const started=process.hrtime.bigint();const graphCacheHit=!!graph;const g=await load();const loaded=process.hrtime.bigint();const a=nearest(g.edges,s),b=nearest(g.edges,t);const snapped=process.hrtime.bigint();if(!a||!b||a.meters>200||b.meters>200)return res.status(422).json({ok:false,mode:'EXPERIMENTAL_SEGMENT_ROUTE',error:'No nearby directed graph segment within 200 m',startSnapMeters:a?Math.round(a.meters):null,endSnapMeters:b?Math.round(b.meters):null,timingMs:{graphLoad:Number(loaded-started)/1e6,snapping:Number(snapped-loaded)/1e6,pathSearch:0,total:Number(snapped-started)/1e6},timingDiagnosticOnly:true,trafficAware:false,routingActivated:false,databaseWrites:0});const searchDiagnostics={};const r=calculate(g,a,b,searchDiagnostics);const routed=process.hrtime.bigint();const timingMs={graphLoad:Number(loaded-started)/1e6,snapping:Number(snapped-loaded)/1e6,pathSearch:Number(routed-snapped)/1e6,total:Number(routed-started)/1e6};if(!r)return res.status(404).json(noPathResponse(timingMs,searchDiagnostics.visited,g.edges.length,graphCacheHit));res.json({ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',graphEdges:g.edges.length,graphVersion:COL,graphCacheHit,timingMs,timingDiagnosticOnly:true,...routeAsGeoJSON(r),...g.nodeGeometry,...g.topology,...g.strongTopology,startSnapMeters:Math.round(a.meters),endSnapMeters:Math.round(b.meters),startSnapCandidatesWithin200m:a.candidatesWithin200,endSnapCandidatesWithin200m:b.candidatesWithin200,startSnapAmbiguous:a.ambiguousSnap,endSnapAmbiguous:b.ambiguousSnap,snapAmbiguityAdvisoryOnly:true,illustrativeEtaMinutes:Math.round(r.distanceMeters/1000/30*60*10)/10,etaAssumedSpeedKmh:30,trafficAware:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,turnReviewSource:'OSM_v493_UNVERIFIED_VIA_NODE_AND_VIA_WAY_PATH_CANDIDATES',legalDrivingRouteVerified:false,routingActivated:false,databaseWrites:0});}catch(e){console.error('KL 3C:',e.message);res.status(503).json({ok:false,error:'KL preview temporarily unavailable'});}});
module.exports={router,project,nearest,calculate,distance,accessCaution,routeAsGeoJSON,noPathResponse,graphDiagnostics,preloadGraph:load};
