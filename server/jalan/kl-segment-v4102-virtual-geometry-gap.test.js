'use strict';
// Synthetic regressions for displaced imported OSM coordinates at virtual
// zero-distance endpoint connectors. Diagnostic only; not road-safety approval.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const SHIFTED=[3.1402,101.681]; // ~22 m displaced geometry at shared node 'b'
function edge(id,from,to,a,b){
 return {id,from,to,a,b,len:distance(a,b)};
}
function graph(edges){
 const adj=new Map();
 for(const e of edges){
  if(!adj.has(e.from))adj.set(e.from,[]);
  adj.get(e.from).push(e);
 }
 return {adj,edges};
}
function snap(e,t){
 return {edge:e,t,point:[
  e.a[0]+(e.b[0]-e.a[0])*t,
  e.a[1]+(e.b[1]-e.a[1])*t
 ]};
}
test('zero-length departure connector exposes displaced shared-node geometry',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',SHIFTED,C);
 const r=calculate(graph([ab,bc]),snap(ab,1),snap(bc,.5));
 assert.ok(r);
 assert.equal(r.geometryGapReviewAvailable,true);
 assert.equal(r.geometryGapTransitionsInspected,1);
 assert.equal(r.geometryGapCountOverThreshold,1);
 assert.ok(r.geometryMaxGapMeters>20);
 assert.equal(r.advisoryEdgesInspected,1); // zero connector is not a driven road
});
test('zero-length arrival connector exposes displaced shared-node geometry',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',SHIFTED,C);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,0));
 assert.ok(r);
 assert.equal(r.geometryGapReviewAvailable,true);
 assert.equal(r.geometryGapTransitionsInspected,1);
 assert.equal(r.geometryGapCountOverThreshold,1);
 assert.ok(r.geometryMaxGapMeters>20);
 assert.equal(r.advisoryEdgesInspected,1);
});
test('consistent zero-length departure and arrival connectors remain zero-gap',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const g=graph([ab,bc]);
 for(const [s,t] of [[snap(ab,1),snap(bc,.5)],[snap(ab,.5),snap(bc,0)]]){
  const r=calculate(g,s,t);
  assert.ok(r);
  assert.equal(r.geometryGapTransitionsInspected,1);
  assert.equal(r.geometryGapCountOverThreshold,0);
  assert.equal(r.geometryMaxGapMeters,0);
 }
});
test('single-edge zero-distance route requires no phantom transition',()=>{
 const ab=edge('ab','a','b',A,B);
 const r=calculate(graph([ab]),snap(ab,.4),snap(ab,.4));
 assert.ok(r);
 assert.equal(r.distanceMeters,0);
 assert.equal(r.geometryGapTransitionsInspected,0);
 assert.equal(r.geometryGapCountOverThreshold,0);
});
