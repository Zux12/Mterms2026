'use strict';
// V4.10.2: virtual endpoint connectors with zero distance are graph plumbing,
// NOT roads a driver travelled. They must not generate access/turn warnings.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681],D=[3.142,101.681];
function edge(id,from,to,a,b,restricted=false){
 return {id,from,to,a,b,len:distance(a,b),potentialAccessCaution:restricted};
}
function snap(e,t){
 return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};
}
function graph(edges,turnRestrictions=[]){
 const adj=new Map();
 for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
 return {adj,edges,turnRestrictions};
}
const ab=()=>edge('osm-way-11:0:F','a','b',A,B,true);
const bc=()=>edge('osm-way-12:0:F','b','c',B,C,false);
const cd=()=>edge('osm-way-13:0:F','c','d',C,D,false);
const noTurn={restrictionId:'demo-node',restriction:'no_right_turn',
 fromWay:'osm-way-11',toWay:'osm-way-12',viaNodes:['b'],viaWays:[]};
test('starting at downstream end of a restricted road does not count that untravelled road',()=>{
 const a=ab(),b=bc(),r=calculate(graph([a,b]),snap(a,1),snap(b,.5));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,0);
 assert.equal(r.geometryGapTransitionsInspected,0);
});
test('ending at upstream end of restricted road does not count that untravelled road',()=>{
 const a=bc(),b=edge('osm-way-14:0:F','c','d',C,D,true);
 const r=calculate(graph([a,b]),snap(a,.5),snap(b,0));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,0);
 assert.equal(r.geometryGapTransitionsInspected,0);
});
test('zero-length same-edge journey does not report restricted road traversed',()=>{
 const a=ab(),r=calculate(graph([a]),snap(a,.3),snap(a,.3));
 assert.ok(r);assert.equal(r.distanceMeters,0);
 assert.equal(r.potentialAccessReviewEdges,0);
 assert.equal(r.geometry.type,undefined); // coordinates array remains a plain route result
 assert.ok(r.geometry.length>=2);
});
test('real partial traversal still reports restricted access',()=>{
 const a=ab(),b=bc(),r=calculate(graph([a,b]),snap(a,.5),snap(b,0));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,1);
});
test('zero-length start connector does not create a phantom via-node turn',()=>{
 const a=ab(),b=bc();
 const r=calculate(graph([a,b],[noTurn]),snap(a,1),snap(b,.5));
 assert.ok(r);assert.equal(r.potentialTurnRestrictionReviewCount,0);
 assert.equal(r.turnReviewTransitionsInspected,0);
});
test('a real incoming and outgoing traversal still triggers the advisory',()=>{
 const a=ab(),b=bc();
 const r=calculate(graph([a,b],[noTurn]),snap(a,.5),snap(b,.5));
 assert.ok(r);assert.equal(r.potentialTurnRestrictionReviewCount,1);
 assert.equal(r.turnReviewTransitionsInspected,1);
});
test('zero-length start connector does not create a phantom via-way match',()=>{
 const a=ab(),b=bc(),c=cd();
 const via={restrictionId:'demo-via',restriction:'no_left_turn',fromWay:'osm-way-11',
  toWay:'osm-way-13',viaNodes:[],viaWays:['osm-way-12']};
 const r=calculate(graph([a,b,c],[via]),snap(a,1),snap(c,.5));
 assert.ok(r);assert.equal(r.turnReviewViaWayPathCandidateCount,0);
});
test('actual via-way traversal remains observable after excluding phantom connectors',()=>{
 const a=ab(),b=bc(),c=cd();
 const via={restrictionId:'demo-via',restriction:'no_left_turn',fromWay:'osm-way-11',
  toWay:'osm-way-13',viaNodes:[],viaWays:['osm-way-12']};
 const r=calculate(graph([a,b,c],[via]),snap(a,.5),snap(c,.5));
 assert.ok(r);assert.equal(r.turnReviewViaWayNoTurnCandidateCount,1);
});
