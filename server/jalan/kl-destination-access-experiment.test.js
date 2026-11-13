'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {distance}=require('./kl-segment-v4102');
const {filteredGraph,candidateSnaps,compareDestinationAccess}=
 require('./kl-destination-access-experiment');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.14,101.682],D=[3.14015,101.682];
const edge=(id,from,to,a,b,caution=false)=>({
 id,from,to,a,b,len:distance(a,b),potentialAccessCaution:caution
});
function graph(edges){
 const adj=new Map();for(const e of edges){
  if(!adj.has(e.from))adj.set(e.from,[]);
  adj.get(e.from).push(e);
 }
 return {edges,adj};
}
function fixture(){
 return graph([
  edge('osm-way-100:0:F','a','b',A,B),
  edge('osm-way-101:0:F','b','c',B,C,true),
  edge('osm-way-102:0:F','b','d',B,D)
 ]);
}
test('compares restricted shortest road with reachable unflagged arrival candidate',()=>{
 const g=fixture(),before=g.edges.length;
 const r=compareDestinationAccess(g,A,C,{maxWalkMeters:90});
 assert.equal(r.ok,true);
 assert.equal(r.baseline.found,true);
 assert.equal(r.baseline.accessCautionEdges,1);
 assert.ok(r.selectedAdvisoryAlternative);
 assert.equal(r.selectedAdvisoryAlternative.roadEdgeId,'osm-way-102:0:F');
 assert.equal(r.selectedAdvisoryAlternative.accessCautionEdges,0);
 assert.equal(r.selectedAdvisoryAlternative.walkingPathVerified,false);
 assert.equal(r.selectedAdvisoryAlternative.accessLegalityVerified,false);
 assert.equal(r.routeLegalityVerified,false);
 assert.equal(r.productionRoutingAuthorized,false);
 assert.equal(g.edges.length,before,'must not mutate the original graph');
 assert.ok(g.adj.get('b').some(e=>e.potentialAccessCaution));
});
test('all restricted arrival options fail closed rather than clearing warnings',()=>{
 const g=graph([
  edge('osm-way-100:0:F','a','b',A,B),
  edge('osm-way-101:0:F','b','c',B,C,true)
 ]);
 const r=compareDestinationAccess(g,A,C,{maxWalkMeters:90});
 assert.equal(r.ok,true);
 assert.equal(r.baseline.accessCautionEdges,1);
 assert.equal(r.selectedAdvisoryAlternative,null);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('nearby but disconnected public-looking segment is not a directed route',()=>{
 const ghost=edge('osm-way-103:0:F','isolated','outside',
  [3.14015,101.68195],D);
 const g=graph([
  edge('osm-way-100:0:F','a','b',A,B),
  edge('osm-way-101:0:F','b','c',B,C,true),
  ghost
 ]);
 const r=compareDestinationAccess(g,A,C,{maxWalkMeters:90});
 assert.equal(r.selectedAdvisoryAlternative,null);
 assert.ok(r.alternatives.some(x=>x.roadEdgeId===ghost.id&&
  x.directedRouteFound===false));
});
test('origin itself restricted is not silently replaced',()=>{
 const e=edge('osm-way-104:0:F','a','b',A,B,true);
 const r=compareDestinationAccess(graph([e]),A,B);
 assert.equal(r.ok,false);
 assert.equal(r.reason,'origin-access-review-required');
 assert.equal(r.productionRoutingAuthorized,false);
});
test('candidate search bounded by max walk and count and excludes caution roads',()=>{
 const g=filteredGraph(fixture());
 const snaps=candidateSnaps(g,C,{maxWalkMeters:90,maxCandidates:1});
 assert.equal(snaps.length,1);
 assert.equal(snaps[0].edge.id,'osm-way-102:0:F');
 assert.throws(()=>candidateSnaps(g,C,{maxWalkMeters:300}),/Invalid/);
 assert.throws(()=>candidateSnaps(g,C,{maxCandidates:99}),/Invalid/);
});
test('noncanonical source edge IDs rejected by experimental filtering',()=>{
 const bad=graph([edge('fake','a','b',A,B)]);
 assert.throws(()=>filteredGraph(bad),/Noncanonical/);
});
