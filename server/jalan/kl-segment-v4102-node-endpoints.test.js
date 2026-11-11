'use strict';
// Node endpoint routing checks for JALAN's isolated, read-only KL preview.
// These tests exercise exact endpoint semantics, not legal access/turn enforcement.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.68],D=[3.141,101.681];
function edge(id,from,to,a,b,caution=false){
 return {id,from,to,a,b,len:distance(a,b),potentialAccessCaution:caution};
}
function graph(edges){
 const adj=new Map();
 for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
 return {edges,adj};
}
function snap(e,t){
 return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};
}
test('exact upstream start-node snap may depart along a different outgoing edge',()=>{
 const ab=edge('ab','a','b',A,B,true),ac=edge('ac','a','c',A,C),cd=edge('cd','c','d',C,D);
 const r=calculate(graph([ab,ac,cd]),snap(ab,0),snap(cd,1));
 assert.ok(r);
 assert.equal(r.distanceMeters,Math.round(ac.len+cd.len));
 assert.deepEqual(r.geometry,[[A[1],A[0]],[C[1],C[0]],[D[1],D[0]]]);
 assert.equal(r.potentialAccessReviewEdges,0);
 assert.equal(r.advisoryEdgesInspected,2);
});
test('exact downstream target-node snap may arrive via a different incoming edge',()=>{
 const ac=edge('ac','a','c',A,C),cd=edge('cd','c','d',C,D),bd=edge('bd','b','d',B,D,true);
 const r=calculate(graph([ac,cd,bd]),snap(ac,.25),snap(bd,1));
 assert.ok(r);
 assert.equal(r.distanceMeters,Math.round(ac.len*.75+cd.len));
 assert.deepEqual(r.geometry.at(-1),[D[1],D[0]]);
 assert.equal(r.potentialAccessReviewEdges,0);
 assert.equal(r.advisoryEdgesInspected,2);
});
test('matching coordinates with different directed node IDs do not create a junction',()=>{
 const ab=edge('ab','a','b',A,B),cd=edge('cd','c','d',B,B);
 assert.equal(calculate(graph([ab,cd]),snap(ab,1),snap(cd,1)),null);
});
test('interior start snap cannot jump backward to the upstream node',()=>{
 const ab=edge('ab','a','b',A,B),ac=edge('ac','a','c',A,C),cd=edge('cd','c','d',C,D);
 assert.equal(calculate(graph([ab,ac,cd]),snap(ab,.5),snap(cd,1)),null);
});
test('interior target snap cannot be entered backward from the downstream node',()=>{
 const ab=edge('ab','a','b',A,B),cb=edge('cb','c','b',C,B);
 assert.equal(calculate(graph([ab,cb]),snap(ab,.5),snap(cb,.5)),null);
});
test('same directed node as distinct edge endpoints yields genuine zero-distance journey',()=>{
 const ab=edge('ab','a','b',A,B,true),bc=edge('bc','b','c',B,C,true);
 const r=calculate(graph([ab,bc]),snap(bc,0),snap(ab,1));
 assert.ok(r);
 assert.equal(r.distanceMeters,0);
 assert.deepEqual(r.geometry,[[B[1],B[0]],[B[1],B[0]]]);
 assert.equal(r.advisoryEdgesInspected,0);
 assert.equal(r.potentialAccessReviewEdges,0);
});
