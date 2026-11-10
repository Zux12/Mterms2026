'use strict';
// Additional direction-aware regression scenarios for the experimental preview.
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, distance } = require('./kl-segment-v4102');
const A=[3.14,101.68], B=[3.14,101.681], C=[3.141,101.681];
const e=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(edge,t)=>({edge,t,point:[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const edge of edges){if(!adj.has(edge.from))adj.set(edge.from,[]);adj.get(edge.from).push(edge);}return {adj,edges};};

test('zero-length same-edge journey stays at the snapped location',()=>{
 const ab=e('ab','a','b',A,B),s=snap(ab,.4),r=calculate(graph([ab]),s,s);
 assert.ok(r);
 assert.equal(r.distanceMeters,0);
 assert.deepEqual(r.geometry,[[s.point[1],s.point[0]]]);
});

test('route crosses adjacent directed edges without a gap',()=>{
 const ab=e('ab','a','b',A,B),bc=e('bc','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.25),snap(bc,.75));
 assert.ok(r);
 assert.equal(r.edgeCount,2);
 assert.deepEqual(r.geometry[0],[101.68025,3.14]);
 assert.deepEqual(r.geometry.at(-1),[101.681,3.14075]);
 assert.ok(r.distanceMeters>0);
});

test('opposite-direction edge is not a shortcut for a prohibited movement',()=>{
 const ab=e('ab','a','b',A,B),ba=e('ba','b','a',B,A);
 const r=calculate(graph([ab,ba]),snap(ab,.8),snap(ab,.2));
 assert.ok(r);
 assert.equal(r.edgeCount,3);
 assert.ok(r.distanceMeters>ab.len);
});
