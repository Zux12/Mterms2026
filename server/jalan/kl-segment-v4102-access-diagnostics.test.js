'use strict';
// Access flags are diagnostic only: they do not assert legal road suitability.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance,accessCaution}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681],D=[3.141,101.682];
function edge(id,from,to,a,b,tags={}){
 return {id,from,to,a,b,len:distance(a,b),potentialAccessCaution:accessCaution(tags)};
}
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {edges,adj};}
test('OSM access qualifiers are flagged for review, not silently accepted as legal',()=>{
 for(const value of ['destination','customers','permit','private','no','delivery'])
  for(const field of ['access','vehicle','motorVehicle'])
   assert.equal(accessCaution({[field]:value}),true,field+'='+value);
 assert.equal(accessCaution({access:'permissive',motorVehicle:'yes'}),false);
 assert.equal(accessCaution({}),false);
});
test('potentially restricted middle segment is counted in chosen route',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C,{access:'destination'}),cd=edge('cd','c','d',C,D);
 const r=calculate(graph([ab,bc,cd]),snap(ab,0.5),snap(cd,0.5));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,1);
});
test('potentially restricted origin/destination legs are disclosed',()=>{
 const ab=edge('ab','a','b',A,B,{access:'customers'}),bc=edge('bc','b','c',B,C,{motorVehicle:'destination'});
 const r=calculate(graph([ab,bc]),snap(ab,.2),snap(bc,.8));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,2);
});
test('unrestricted route reports zero potential access-review edges',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.4),snap(bc,.7));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,0);
});
