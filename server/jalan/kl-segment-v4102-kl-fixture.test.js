'use strict';
// A small static KL fixture read from the read-only road_graph_edges_v495
// collection on 2026-11-11. Source road data: OpenStreetMap contributors (ODbL).
// This does NOT prove the full graph is connected or that turns are permitted.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const fixture=[
 {id:'osm-way-1001500784:0:F',from:'1722609884',to:'8010629302',a:[3.1474976,101.7225415],b:[3.1475594,101.7225577]},
 {id:'osm-way-1168915040:0:F',from:'8010629302',to:'1585389577',a:[3.1475594,101.7225577],b:[3.1478894,101.722657]},
 {id:'osm-way-1145059957:0:F',from:'1585389577',to:'1722609915',a:[3.1478894,101.722657],b:[3.1480254,101.7227028]}
].map(e=>({...e,len:distance(e.a,e.b)}));
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=()=>{const adj=new Map();for(const e of fixture)adj.set(e.from,[e]);return {adj,edges:fixture};};
test('sampled actual KL directed-edge chain is traversable and geometrically continuous',()=>{
 const r=calculate(graph(),snap(fixture[0],0.5),snap(fixture[2],0.5));
 assert.ok(r);assert.equal(r.edgeCount,3);assert.equal(r.potentialAccessReviewEdges,0);
 assert.deepEqual(r.geometry[1],[101.7225577,3.1475594]);
 assert.deepEqual(r.geometry[2],[101.722657,3.1478894]);
 const expected=fixture[0].len*.5+fixture[1].len+fixture[2].len*.5;
 assert.ok(Math.abs(r.distanceMeters-expected)<1);
});
test('sampled KL fixture cannot be traversed backwards without a reverse edge',()=>{
 assert.equal(calculate(graph(),snap(fixture[2],.8),snap(fixture[0],.2)),null);
});
