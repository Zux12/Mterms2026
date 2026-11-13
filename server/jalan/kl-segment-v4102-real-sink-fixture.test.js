'use strict';
// Actual imported KL edge-chain fixture: OSM contributors (ODbL).
// Confirms a sink-only endpoint stays unreachable in reverse direction.
// This fixture does not establish whether the import reflects legal road access.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const nodes={
 a:[3.1381497,101.7227397],b:[3.1383861,101.7219019],
 c:[3.13871,101.7208629],d:[3.1381941,101.7229146],
 e:[3.1384913,101.7217093]
};
const edges=[
 ['osm-way-1221539412:1:F','a','b'],
 ['osm-way-1221539413:0:F','b','c'],
 ['osm-way-166734461:2:F','d','e'],
 ['osm-way-291026091:0:F','e','c']
].map(([id,from,to])=>({id,from,to,a:nodes[from],b:nodes[to],len:distance(nodes[from],nodes[to])}));
const graph={edges,adj:new Map()};
for(const edge of edges){if(!graph.adj.has(edge.from))graph.adj.set(edge.from,[]);graph.adj.get(edge.from).push(edge);}
function snap(edge,t){return {edge,t,point:[edge.a[0]+(edge.b[0]-edge.a[0])*t,edge.a[1]+(edge.b[1]-edge.a[1])*t]};}
test('real imported motorway-link chain reaches common terminal sink',()=>{
 const r=calculate(graph,snap(edges[0],0),snap(edges[1],1));
 assert.ok(r);assert.ok(r.distanceMeters>0);
 assert.equal(r.legalDrivingRouteVerified,undefined);
});
test('real imported secondary chain reaches same sink',()=>{
 const r=calculate(graph,snap(edges[2],0),snap(edges[3],1));
 assert.ok(r);assert.ok(r.distanceMeters>0);
});
test('terminal sink cannot travel backward along imported directed edges',()=>{
 const r=calculate(graph,snap(edges[1],1),snap(edges[0],0));
 assert.equal(r,null);
});
test('two upstream corridors are not mutually reachable in this limited fixture',()=>{
 const r=calculate(graph,snap(edges[0],0),snap(edges[2],0));
 assert.equal(r,null);
});
