'use strict';
// Ensure graph routing never accepts backwards travel on a one-way edge,
// including coincident nodes and zero-length connectors.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};};
test('reverse traversal remains forbidden when a zero-length connector is present',()=>{
 const ab=edge('ab','a','b',A,B),bb=edge('bb','b','c',B,B);
 const r=calculate(graph([ab,bb]),snap(ab,.9),snap(ab,.1));
 assert.equal(r,null);
});
test('unreachable target cannot be reached through spatially identical unconnected nodes',()=>{
 const ab=edge('ab','a','b',A,B),cd=edge('cd','c','d',B,C);
 assert.equal(calculate(graph([ab,cd]),snap(ab,.8),snap(cd,.2)),null);
});
