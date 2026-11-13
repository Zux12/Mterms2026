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

test('real Atlas bridge junction joins only matching directed OSM nodes',()=>{
 // Three real layer=1 bridge=yes edges from v495; two approach node
 // 8536168965, and one departs it. This proves node-level connectivity
 // of the imported bridge junction, NOT road access or turn legality.
 const n={
  a:[3.1403992,101.7165977],b:[3.1403564,101.7167411],
  c:[3.140078,101.7177786],d:[3.140344,101.7166837]
 };
 const edges=[
  {id:'osm-way-1007589904:6:F',from:'7700966082',to:'8536168965',a:n.a,b:n.b},
  {id:'osm-way-1007589904:7:F',from:'8536168965',to:'7700966084',a:n.b,b:n.c},
  {id:'osm-way-919093801:9:F',from:'8536168966',to:'8536168965',a:n.d,b:n.b}
 ].map(x=>({...x,len:distance(x.a,x.b)}));
 const g=graph(edges);
 const r=calculate(g,snap(edges[0],0),snap(edges[1],1));
 assert.ok(r);
 assert.equal(r.geometryGapCountOverThreshold,0);
 const incoming=calculate(g,snap(edges[2],0),snap(edges[1],1));
 assert.ok(incoming);
 assert.equal(incoming.geometryGapCountOverThreshold,0);
 assert.equal(calculate(g,snap(edges[1],1),snap(edges[0],0)),null);
});
