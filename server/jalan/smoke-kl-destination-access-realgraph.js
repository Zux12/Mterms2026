'use strict';
// Trusted-branch ONLY real-graph experiment. Uses public OSM way IDs and graph
// endpoints rather than user location/GPS. Read-only. No HTTP route mounted.
const mongoose=require('mongoose');
const {preloadGraph}=require('./kl-segment-v4102');
const {compareDestinationAccess}=require('./kl-destination-access-experiment');
const REQUIRED=168221;
async function main(){
 const uri=process.env.JALAN_READONLY_MONGODB_URI;
 if(!uri)throw Error('Read-only Atlas credential missing');
 try{
  await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'});
  const g=await preloadGraph();
  if(g.edges.length!==REQUIRED)throw Error('Incomplete imported directed KL graph');
  // Public OSM test fixture: unrestricted incoming Leboh Pasar Besar way and
  // destination-only Jalan Mahkamah Tinggi segment, both from imported OSM.
  // NOT the private user's GPS coordinates or an accepted real driving case.
  const source=g.edges.find(x=>x.id==='osm-way-557233421:1:F');
  const target=g.edges.find(x=>x.id==='osm-way-624432328:0:F');
  if(!source||!target||source.potentialAccessCaution||
     !target.potentialAccessCaution)throw Error('Expected public OSM graph fixture changed');
  const start=source.a,dest=target.b;
  const r=compareDestinationAccess(g,start,dest,{maxWalkMeters:150,maxCandidates:8});
  if(!r.ok||!r.baseline.found||r.baseline.accessCautionEdges<1||
     r.productionRoutingAuthorized!==false||r.routeLegalityVerified!==false||
     r.reviewedCandidates<1)
   throw Error('Public destination-access real-graph experiment contract failed');
  for(const x of r.alternatives){
   if(x.accessLegalityVerified!==false||x.turnLegalityVerified!==false||
      x.walkingPathVerified!==false||x.accessCautionEdges!==(
       x.directedRouteFound?0:null))throw Error('Unsafe alternative acceptance claim');
  }
  // Only public edge IDs and scalar diagnostic metrics appear in logs. Never
  // print endpoints, geometry, Atlas URI, auth tokens or user GPS.
  console.log(JSON.stringify({
   type:r.mode,completeImportedEdges:g.edges.length,fixture:'public-OSM-destination-only-approach',
   baseline:{found:r.baseline.found,distanceMeters:r.baseline.distanceMeters,
    cautionEdges:r.baseline.accessCautionEdges},
   candidates:r.alternatives.map(x=>({
    edgeId:x.roadEdgeId,straightLineFinalLegMeters:x.walkingStraightLineMeters,
    directedRouteFound:x.directedRouteFound,drivingDistanceMeters:x.drivingDistanceMeters,
    cautionEdges:x.accessCautionEdges})),
   selectedAdvisoryAlternative:r.selectedAdvisoryAlternative?{
    edgeId:r.selectedAdvisoryAlternative.roadEdgeId,
    straightLineFinalLegMeters:r.selectedAdvisoryAlternative.walkingStraightLineMeters,
    drivingDistanceMeters:r.selectedAdvisoryAlternative.drivingDistanceMeters}:null,
   physicalRoadAccessVerified:false,finalWalkingRouteVerified:false,
   legalDrivingRouteVerified:false,productionRoutingAuthorized:false
  }));
 }finally{await mongoose.disconnect();}
}
main().catch(e=>{
 // Suppress credentials, GPS and stack traces. Print only a known generic error.
 console.error('Public OSM full-KL destination-access experiment unavailable: '+(
  /^Public destination-access|^Incomplete imported|^Expected public OSM|^Read-only Atlas/.test(e.message)?e.message:'controlled diagnostic failed'));
 process.exitCode=1;
});
