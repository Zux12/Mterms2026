'use strict';
// Synthetic node-coordinate QA: none of these cases claims road legality.
const test=require('node:test'),assert=require('node:assert/strict');
const {auditGraphNodeGeometry}=require('./kl-node-geometry-audit-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b});
test('consistent junction shared by incoming and outgoing edges has zero spread',()=>{
 const r=auditGraphNodeGeometry([edge('ab','a','b',A,B),edge('bc','b','c',B,C)]);
 assert.equal(r.graphNodeGeometryReviewAvailable,true);
 assert.equal(r.graphNodesAudited,3);assert.equal(r.graphEndpointObservations,4);
 assert.equal(r.graphNodesWithSpreadOver2m,0);assert.equal(r.graphMaxNodeSpreadUpperBoundMeters,0);
 assert.equal(r.graphNodeGeometryAdvisoryOnly,true);
});
test('same node ID with displaced coordinate is flagged even with connected topology',()=>{
 const r=auditGraphNodeGeometry([edge('ab','a','b',A,B),
  edge('bc','b','c',[3.14012,101.681],C)]);
 assert.equal(r.graphNodesWithSpreadOver2m,1);
 assert.ok(r.graphMaxNodeSpreadUpperBoundMeters>10);
});
test('bounding spread catches opposite shifts that a first-point anchor misses',()=>{
 const center=[3.14,101.68],north=[3.140014,101.68],south=[3.139986,101.68];
 const r=auditGraphNodeGeometry([edge('0','a','shared',A,center),
  edge('1','shared','b',north,C),edge('2','shared','c',south,B)]);
 assert.equal(r.graphNodesWithSpreadOver2m,1);
 assert.ok(r.graphMaxNodeSpreadUpperBoundMeters>3);
});
test('different node IDs at identical coordinates are not inferred to be connected',()=>{
 const r=auditGraphNodeGeometry([edge('ab','a','b',A,B),
  edge('xy','x','y',B,C)]);
 assert.equal(r.graphNodesAudited,4);
 assert.equal(r.graphNodesWithSpreadOver2m,0);
});
test('malformed endpoint coordinates and unknown node identities remain unknown',()=>{
 for(const bad of [
  edge('x','a','b',[NaN,101.68],B),
  edge('x','a','b',[3.14],B),
  edge('x','a',null,A,B),
  edge('x','a','b',[91,101.68],B)]){
  const r=auditGraphNodeGeometry([bad]);
  assert.equal(r.graphNodeGeometryReviewAvailable,false);
  assert.equal(r.graphNodesWithSpreadOver2m,null);
  assert.equal(r.graphMaxNodeSpreadUpperBoundMeters,null);
 }
});
test('empty graph cannot silently claim zero coordinate mismatches',()=>{
 const r=auditGraphNodeGeometry([]);
 assert.equal(r.graphNodeGeometryReviewAvailable,false);
 assert.equal(r.graphNodesAudited,null);
 assert.equal(r.graphNodesWithSpreadOver2m,null);
});
test('invalid thresholds are rejected instead of producing a false clearance',()=>{
 assert.throws(()=>auditGraphNodeGeometry([], -1),TypeError);
 assert.throws(()=>auditGraphNodeGeometry([], NaN),TypeError);
});
