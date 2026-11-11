'use strict';
// Synthetic advisory regressions. A detour warning never proves an illegal path.
const test=require('node:test'),assert=require('node:assert/strict');
const {auditRoutePlausibility}=require('./kl-route-plausibility-audit-v4102');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],X=[3.15,101.68],Y=[3.15,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {edges,adj};}
test('direct travel has no detour or implausibly short-distance warning',()=>{
 const direct=distance(A,B),q=auditRoutePlausibility(direct,A,B,distance);
 assert.equal(q.routePlausibilityReviewAvailable,true);
 assert.equal(q.routeDetourRatio,1);
 assert.equal(q.routeDetourReviewCandidate,false);
 assert.equal(q.routeTooShortReviewCandidate,false);
 assert.equal(q.routePlausibilityAdvisoryOnly,true);
});
test('highly circuitous path is flagged, without alleging an illegal turn',()=>{
 const q=auditRoutePlausibility(distance(A,X)+distance(X,Y)+distance(Y,B),A,B,distance);
 assert.equal(q.routePlausibilityReviewAvailable,true);
 assert.ok(q.routeDetourRatio>4);
 assert.equal(q.routeDetourReviewCandidate,true);
 assert.equal(q.routeTooShortReviewCandidate,false);
});
test('distance considerably below straight-line lower bound gets independent caution',()=>{
 const q=auditRoutePlausibility(70,A,B,distance);
 assert.equal(q.routeDetourReviewCandidate,false);
 assert.equal(q.routeTooShortReviewCandidate,true);
});
test('short nearby journeys have unknown ratio, not a misleading clearance',()=>{
 const short=[3.14,101.68001],q=auditRoutePlausibility(distance(A,short),A,short,distance);
 assert.equal(q.routePlausibilityReviewAvailable,false);
 assert.equal(q.routeDetourReviewCandidate,null);
 assert.equal(q.routeTooShortReviewCandidate,null);
 assert.equal(q.routeDetourRatio,null);
 assert.ok(q.routeDirectDistanceMeters>=0);
});
test('invalid points, negative distance and nonfinite costs fail closed',()=>{
 for(const args of [[1,[NaN,101],B,distance],[-1,A,B,distance],
  [Infinity,A,B,distance],[1,[91,101],B,distance],
  [1,A,B,()=>NaN],[1,A,B,null]]){
  const q=auditRoutePlausibility(...args);
  assert.equal(q.routePlausibilityReviewAvailable,false);
  assert.equal(q.routeDetourReviewCandidate,null);
 }
});
test('threshold configuration must be finite and nondegenerate',()=>{
 assert.throws(()=>auditRoutePlausibility(1,A,B,distance,1),TypeError);
 assert.throws(()=>auditRoutePlausibility(1,A,B,distance,4,0),TypeError);
 assert.throws(()=>auditRoutePlausibility(1,A,B,distance,NaN),TypeError);
});
test('integrated directed-route response highlights a synthetic large detour',()=>{
 const ax=edge('ax','a','x',A,X),xy=edge('xy','x','y',X,Y),yb=edge('yb','y','b',Y,B);
 const result=calculate(graph([ax,xy,yb]),snap(ax,0),snap(yb,1));
 assert.ok(result);
 assert.equal(result.routePlausibilityReviewAvailable,true);
 assert.equal(result.routeDetourReviewCandidate,true);
 assert.equal(result.routeTooShortReviewCandidate,false);
 assert.ok(result.routeDetourRatio>4);
 assert.ok(result.distanceMeters>result.routeDirectDistanceMeters);
});
test('integrated same-edge stationary trip has unknown detour ratio',()=>{
 const ab=edge('ab','a','b',A,B),r=calculate(graph([ab]),snap(ab,.4),snap(ab,.4));
 assert.ok(r);assert.equal(r.distanceMeters,0);
 assert.equal(r.routePlausibilityReviewAvailable,false);
 assert.equal(r.routeDetourReviewCandidate,null);
});
