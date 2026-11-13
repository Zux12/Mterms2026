'use strict';
// Ensure access caution is a warning, never an implicit claim of legal clearance.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const edge=(id,from,to,a,b,caution=false)=>({id,from,to,a,b,len:distance(a,b),potentialAccessCaution:caution});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};};
test('access caution is counted for every traversed flagged edge',()=>{
 const ab=edge('ab','a','b',A,B,true),bc=edge('bc','b','c',B,C,true);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,2);
});
test('unreachable route is not reported as an access-cleared route',()=>{
 const ab=edge('ab','a','b',A,B,true),cd=edge('cd','c','d',B,C);
 assert.equal(calculate(graph([ab,cd]),snap(ab,.5),snap(cd,.5)),null);
});
