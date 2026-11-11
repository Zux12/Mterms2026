'use strict';
// A graph edge's external ID is a label, not proof that two snap candidates
// refer to the identical directed segment. This is synthetic diagnostic coverage.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.14,101.682],D=[3.14,101.683];
function edge(id,from,to,a,b){return {id,from,to,a,b,len:distance(a,b)};}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};}

test('colliding edge IDs must not invent a direct route across disconnected streets',()=>{
 const ab=edge('same-import-id','a','b',A,B),cd=edge('same-import-id','c','d',C,D);
 const result=calculate(graph([ab,cd]),snap(ab,.2),snap(cd,.8));
 assert.equal(result,null);
});
test('colliding IDs on consecutive streets must not create a geometric shortcut',()=>{
 const ab=edge('same-import-id','a','b',A,B),bc=edge('same-import-id','b','c',B,C);
 const result=calculate(graph([ab,bc]),snap(ab,.25),snap(bc,.75));
 assert.ok(result);
 assert.ok(Math.abs(result.distanceMeters-(ab.len*.75+bc.len*.75))<2);
 assert.equal(result.edgeCount,2);
 assert.ok(result.geometry.some(([lng,lat])=>Math.abs(lng-B[1])<1e-9&&Math.abs(lat-B[0])<1e-9));
});
test('a single shared edge object still supports forward partial-edge routing',()=>{
 const ab=edge('same-import-id','a','b',A,B);
 const result=calculate(graph([ab]),snap(ab,.2),snap(ab,.8));
 assert.ok(result);
 assert.ok(Math.abs(result.distanceMeters-ab.len*.6)<2);
 assert.equal(result.edgeCount,1);
});
test('reversed travel on a single one-way edge remains unreachable',()=>{
 const ab=edge('same-import-id','a','b',A,B);
 assert.equal(calculate(graph([ab]),snap(ab,.8),snap(ab,.2)),null);
});
