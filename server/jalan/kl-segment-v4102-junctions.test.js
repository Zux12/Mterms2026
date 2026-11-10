'use strict';
// Junction and road-network topology regression cases for the isolated KL preview.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681],D=[3.141,101.68];
function edge(id,from,to,a,b){return {id,from,to,a,b,len:distance(a,b)};}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};}
test('junction requires directed connection rather than geographic proximity',()=>{
 const ab=edge('ab','a','b',A,B),cb=edge('cb','c','b',C,B);
 assert.equal(calculate(graph([ab,cb]),snap(ab,.5),snap(cb,.5)),null);
});
test('junction with legal outgoing turn yields continuous route',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);
 assert.equal(r.edgeCount,2);
 assert.deepEqual(r.geometry[1],[B[1],B[0]]);
});
test('a disconnected road crossing does not create an artificial junction',()=>{
 const ab=edge('ab','a','b',A,C),cd=edge('cd','c','d',B,D);
 assert.equal(calculate(graph([ab,cd]),snap(ab,.5),snap(cd,.5)),null);
});
test('equal-length alternative paths yield a valid directed result',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C),ad=edge('ad','a','d',A,D),dc=edge('dc','d','c',D,C),da=edge('da','d','a',D,A);
 // Start at the END of an incoming edge: start-node travel is forward-only.
 const r=calculate(graph([ab,bc,ad,dc,da]),snap(da,1),snap(dc,1));
 assert.ok(r);
 assert.ok(r.distanceMeters>0);
 assert.deepEqual(r.geometry[0],[A[1],A[0]]);
 assert.deepEqual(r.geometry.at(-1),[C[1],C[0]]);
});
