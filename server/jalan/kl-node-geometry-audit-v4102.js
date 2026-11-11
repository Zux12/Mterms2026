'use strict';
// Read-only QA for the isolated KL graph. If all endpoints sharing an OSM node
// share the same coordinates, every graph-node transition is geometrically
// continuous. This does NOT validate node identity, legality or road topology.
// An axis-aligned geographic spread is an upper bound, not a pairwise distance.
const RAD=Math.PI/180, METERS_PER_DEGREE=111195;
function validPoint(p){
 return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&
  Math.abs(p[0])<=90&&Math.abs(p[1])<=180; // [latitude, longitude]
}
function unavailable(thresholdMeters){
 return {graphNodeGeometryReviewAvailable:false,graphNodesAudited:null,
  graphEndpointObservations:null,graphNodesWithSpreadOver2m:null,
  graphMaxNodeSpreadUpperBoundMeters:null,graphNodeSpreadThresholdMeters:thresholdMeters,
  graphNodeGeometryAdvisoryOnly:true};
}
function auditGraphNodeGeometry(edges,thresholdMeters=2){
 if(!Array.isArray(edges)||!Number.isFinite(thresholdMeters)||thresholdMeters<0)
  throw new TypeError('Expected graph edges and a nonnegative threshold');
 if(!edges.length)return unavailable(thresholdMeters);
 const nodes=new Map();
 for(const e of edges){
  for(const [id,p] of [[e?.from,e?.a],[e?.to,e?.b]]){
   if(typeof id!=='string'||!id||!validPoint(p))return unavailable(thresholdMeters);
   const found=nodes.get(id);
   if(!found)nodes.set(id,{minLat:p[0],maxLat:p[0],minLon:p[1],maxLon:p[1]});
   else{
    found.minLat=Math.min(found.minLat,p[0]);found.maxLat=Math.max(found.maxLat,p[0]);
    found.minLon=Math.min(found.minLon,p[1]);found.maxLon=Math.max(found.maxLon,p[1]);
   }
  }
 }
 let mismatched=0,max=0;
 for(const bounds of nodes.values()){
  const midLat=(bounds.minLat+bounds.maxLat)/2;
  const spread=Math.hypot(
   (bounds.maxLat-bounds.minLat)*METERS_PER_DEGREE,
   (bounds.maxLon-bounds.minLon)*METERS_PER_DEGREE*Math.cos(midLat*RAD));
  if(!Number.isFinite(spread))return unavailable(thresholdMeters);
  if(spread>thresholdMeters)mismatched++;
  max=Math.max(max,spread);
 }
 return {graphNodeGeometryReviewAvailable:true,graphNodesAudited:nodes.size,
  graphEndpointObservations:edges.length*2,graphNodesWithSpreadOver2m:mismatched,
  graphMaxNodeSpreadUpperBoundMeters:Math.round(max*10)/10,
  graphNodeSpreadThresholdMeters:thresholdMeters,graphNodeGeometryAdvisoryOnly:true};
}
module.exports={auditGraphNodeGeometry};
