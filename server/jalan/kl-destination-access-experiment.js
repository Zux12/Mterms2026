'use strict';
// OFFLINE, advisory-only experiment; not mounted on any HTTP route or live nav.
// Compare an existing shortest imported-graph route to candidates that avoid
// OSM access-caution edges. Absence of an OSM tag is NOT proof of public access.
const {nearest,calculate,project,distance}=require('./kl-segment-v4102');
const VALID_ROAD=/^osm-way-[1-9]\d*:(0|[1-9]\d*):[FR]$/;
function filteredGraph(g){
 if(!g||!Array.isArray(g.edges)||!(g.adj instanceof Map))
  throw new TypeError('Directed imported graph required');
 const edges=g.edges.filter(e=>!e.potentialAccessCaution);
 const adj=new Map();
 for(const e of edges){
  if(!VALID_ROAD.test(e.id)||!Array.isArray(e.a)||!Array.isArray(e.b)||
     typeof e.from!=='string'||typeof e.to!=='string')
   throw Error('Noncanonical imported road edge');
  if(!adj.has(e.from))adj.set(e.from,[]);
  adj.get(e.from).push(e);
 }
 return {edges,adj,turnRestrictions:g.turnRestrictions??null};
}
function candidateSnaps(g,destination,{maxWalkMeters=150,maxCandidates=8}={}){
 if(!Array.isArray(destination)||destination.length!==2||
    !destination.every(Number.isFinite)||maxWalkMeters<=0||
    maxWalkMeters>200||!Number.isSafeInteger(maxCandidates)||maxCandidates<1||
    maxCandidates>32)throw new TypeError('Invalid bounded destination review');
 const rows=[];
 for(const e of g.edges){
  const snap=project(destination,e.a,e.b);
  if(snap.meters<=maxWalkMeters){
   rows.push({...snap,edge:e,walkMeters:snap.meters});
  }
 }
 rows.sort((a,b)=>a.walkMeters-b.walkMeters||a.edge.id.localeCompare(b.edge.id));
 // Different segments of one OSM way are distinct directed arrival options.
 // Deduplicate on edgeId, not on coordinates; never bridge disconnected IDs.
 const ids=new Set(),out=[];
 for(const c of rows){
  if(ids.has(c.edge.id))continue;
  ids.add(c.edge.id);
  out.push(c);
  if(out.length===maxCandidates)break;
 }
 return out;
}
function compareDestinationAccess(g,start,destination,options={}){
 const graph=filteredGraph(g);
 const startSnap=nearest(g.edges,start);
 const originalEndSnap=nearest(g.edges,destination);
 if(!startSnap||!originalEndSnap)return {ok:false,reason:'no-nearby-imported-road'};
 const baseline=calculate(g,startSnap,originalEndSnap);
 const mode='ADVISORY_DESTINATION_ACCESS_EXPERIMENT';
 // An origin on an access-caution road also needs purpose review; do not
 // substitute an unrelated origin or imply public reachability.
 if(startSnap.edge.potentialAccessCaution)
  return {ok:false,reason:'origin-access-review-required',mode,
   baselineFound:!!baseline,productionRoutingAuthorized:false};
 const candidateList=candidateSnaps(graph,destination,options);
 const candidates=candidateList.map(snap=>{
  const result=calculate(graph,startSnap,snap);
  return {roadEdgeId:snap.edge.id,
   walkingStraightLineMeters:Math.round(snap.walkMeters*10)/10,
   directedRouteFound:!!result,
   drivingDistanceMeters:result?result.distanceMeters:null,
   accessCautionEdges:result?result.potentialAccessReviewEdges:null,
   // Unverified tagged/no-tagged map does not authorize a passenger drop-off.
   accessLegalityVerified:false,
   turnLegalityVerified:false,
   walkingPathVerified:false};
 });
 const reachable=candidates.filter(x=>x.directedRouteFound&&x.accessCautionEdges===0);
 reachable.sort((a,b)=>a.walkingStraightLineMeters-b.walkingStraightLineMeters||
  a.drivingDistanceMeters-b.drivingDistanceMeters);
 return {ok:true,mode,baseline:{
  found:!!baseline,
  distanceMeters:baseline?.distanceMeters??null,
  accessCautionEdges:baseline?.potentialAccessReviewEdges??null
 },reviewedCandidates:candidates.length,
  selectedAdvisoryAlternative:reachable[0]??null,
  alternatives:candidates,
  // A nearby road is not necessarily walkable or legally accessible.
  routeLegalityVerified:false,productionRoutingAuthorized:false};
}
module.exports={filteredGraph,candidateSnaps,compareDestinationAccess};
