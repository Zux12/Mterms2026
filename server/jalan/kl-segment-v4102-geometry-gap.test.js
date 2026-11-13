'use strict';
// Node connectivity alone cannot guarantee that imported coordinates meet.
// All geometries below are synthetic; the KL pilot remains unverified.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const {auditPathGeometryGaps}=require('./kl-path-geometry-audit-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const ab=edge('osm-way-1:0:F','a','b',A,B);
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};};
test('connected nodes and matching coordinates produce zero gap advisory',()=>{
 const bc=edge('osm-way-2:0:F','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);
 assert.equal(r.geometryGapReviewAvailable,true);
 assert.equal(r.geometryGapTransitionsInspected,1);
 assert.equal(r.geometryGapCountOverThreshold,0);
 assert.equal(r.geometryMaxGapMeters,0);
 assert.equal(r.geometryGapAdvisoryOnly,true);
});
test('shared node ID with displaced coordinates is flagged, not silently cleared',()=>{
 const shifted=[3.14012,101.681];
 const bc=edge('osm-way-2:0:F','b','c',shifted,C);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);
 assert.equal(r.geometryGapTransitionsInspected,1);
 assert.equal(r.geometryGapThresholdMeters,2);
 assert.equal(r.geometryGapCountOverThreshold,1);
 assert.ok(r.geometryMaxGapMeters>10);
});
test('partial edge alone has no internal inter-edge transition to inspect',()=>{
 const r=calculate(graph([ab]),snap(ab,.2),snap(ab,.8));
 assert.ok(r);
 assert.equal(r.geometryGapTransitionsInspected,0);
 assert.equal(r.geometryGapCountOverThreshold,0);
});
test('malformed path coordinates yield unknown rather than a fabricated zero',()=>{
 const bad=auditPathGeometryGaps([{coords:[A,B]},{coords:[null,C]}],distance);
 assert.equal(bad.geometryGapReviewAvailable,false);
 assert.equal(bad.geometryGapCountOverThreshold,null);
 assert.equal(bad.geometryMaxGapMeters,null);
});
test('logical disconnection never produces a route and gap clearance',()=>{
 const bc=edge('osm-way-2:0:F','x','c',B,C);
 assert.equal(calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5)),null);
});
