'use strict';
// Edge-case regression tests for the isolated KL directed routing preview.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance,project}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};};
test('snap projection clamps points beyond both segment ends',()=>{
 const p1=project([3.14,101.679],A,B),p2=project([3.14,101.682],A,B);
 assert.equal(p1.t,0);
 assert.equal(p2.t,1);
 assert.ok(p1.meters>0);
 assert.ok(p2.meters>0);
});
test('a parallel opposing edge cannot be entered from an unconnected node',()=>{
 const ab=edge('ab','a','b',A,B),cd=edge('cd','c','d',B,A);
 assert.equal(calculate(graph([ab,cd]),snap(ab,.75),snap(cd,.25)),null);
});
test('a legal two-edge chain preserves destination partial edge',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.9),snap(bc,.1));
 assert.ok(r);
 assert.equal(r.edgeCount,2);
 assert.deepEqual(r.geometry.at(-1),[101.681,3.1401]);
 assert.ok(r.distanceMeters>0);
});
