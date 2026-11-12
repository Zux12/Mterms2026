'use strict';
// Actual v495 OSM identifiers and endpoints read from Atlas 12 Nov 2026.
// Bounded imported-edge topology witness, NOT proof of bridge legality.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const nodes={
 a:[3.140078,101.7177786],b:[3.1403564,101.7167411],
 c:[3.1404,101.7166],d:[3.1405,101.7165],
 e:[3.1406,101.7164]
};
function e(id,from,to){return {id,from,to,a:nodes[from],b:nodes[to],len:distance(nodes[from],nodes[to])};}
function graph(edges){const adj=new Map();for(const x of edges){if(!adj.has(x.from))adj.set(x.from,[]);adj.get(x.from).push(x);}return {edges,adj};}
function snap(x,t){return {edge:x,t,point:[x.a[0]+(x.b[0]-x.a[0])*t,x.a[1]+(x.b[1]-x.a[1])*t]};}
test('real imported bridge directed edge is reachable in its own forward orientation',()=>{
 // osm-way-1007589904:7:F has fromNode 8536168965 (b) toNode 7700966084 (a).
 const bridge=e('osm-way-1007589904:7:F','b','a');
 const g=graph([bridge]);
 assert.ok(calculate(g,snap(bridge,0.1),snap(bridge,0.9)));
 assert.equal(calculate(g,snap(bridge,0.9),snap(bridge,0.1)),null);
});
test('real imported bridge endpoint identifiers cannot jump to nearby unrelated nodes',()=>{
 const bridge=e('osm-way-1007589904:7:F','b','a');
 const disconnected=e('osm-way-unrelated-fixture:0:F','c','d');
 const g=graph([bridge,disconnected]);
 assert.equal(calculate(g,snap(bridge,0.2),snap(disconnected,0.8)),null);
});
