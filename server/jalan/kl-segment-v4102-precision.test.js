'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const e=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(edge,t)=>({edge,t,point:[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const edge of edges){if(!adj.has(edge.from))adj.set(edge.from,[]);adj.get(edge.from).push(edge);}return {adj,edges};};
test('zero-length segment does not cause an infinite routing loop',()=>{
 const ab=e('ab','a','b',A,B),bb=e('bb','b','c',B,B),bc=e('bc','c','d',B,C);
 const r=calculate(graph([ab,bb,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);assert.ok(Number.isFinite(r.distanceMeters));assert.ok(r.visited<=8);
});
test('routing result is stable when unrelated disconnected edges are added',()=>{
 const ab=e('ab','a','b',A,B),bc=e('bc','b','c',B,C),xy=e('xy','x','y',[3.2,101.7],[3.201,101.7]);
 const a=calculate(graph([ab,bc]),snap(ab,.3),snap(bc,.6));
 const b=calculate(graph([ab,bc,xy]),snap(ab,.3),snap(bc,.6));
 assert.deepEqual(a.geometry,b.geometry);assert.equal(a.distanceMeters,b.distanceMeters);
});
