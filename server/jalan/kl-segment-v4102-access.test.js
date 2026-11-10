'use strict';
// Access tags are advisory only; the preview must never imply legal clearance.
const test=require('node:test');
const assert=require('node:assert/strict');
const {accessCaution,calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
function edge(id,from,to,a,b,caution=false){return {id,from,to,a,b,len:distance(a,b),potentialAccessCaution:caution};}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {edges,adj};}
test('restricted access tags trigger conservative advisory',()=>{
 for(const value of ['destination','customers','permit','private','no','delivery','PRIVATE']){
  assert.equal(accessCaution({motorVehicle:value}),true,value);
 }
 assert.equal(accessCaution({access:'yes',vehicle:'yes',motorVehicle:'yes'}),false);
 assert.equal(accessCaution({}),false);
});
test('access warning follows traversed directed route edges',()=>{
 const ab=edge('ab','a','b',A,B,true),bc=edge('bc','b','c',B,C,false);
 const result=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(result);assert.equal(result.potentialAccessReviewEdges,1);
});
test('untraversed restricted alternative does not create a false warning',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const ac=edge('ac','a','c',A,C,true);
 const result=calculate(graph([ab,bc,ac]),snap(ab,.5),snap(bc,.5));
 assert.ok(result);assert.equal(result.potentialAccessReviewEdges,0);
});
