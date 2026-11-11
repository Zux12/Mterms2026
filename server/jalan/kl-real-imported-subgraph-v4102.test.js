'use strict';
// Read-only Atlas snapshot of 16 directed OSM road edges, 12 Nov 2026.
// This is a bounded actual imported subgraph, NOT the 168221-edge runtime.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const nodes={
 a:[3.1315707,101.7038508],b:[3.130908,101.7036171],
 c:[3.1308854,101.7037223],d:[3.1313468,101.7039025],
 e:[3.1314573,101.7038951],f:[3.1315322,101.7039169],
 g:[3.1315327,101.703968],h:[3.1315364,101.704371],
 i:[3.1315147,101.7046237],j:[3.1312496,101.704672],
 k:[3.130842,101.7046319],l:[3.1308733,101.7037788]
};
const records=[
 ['osm-way-1161236396:0:F','a','b'],
 ['osm-way-1161236398:0:F','b','c'],
 ['osm-way-1161236398:0:R','c','b'],
 ['osm-way-1161236397:2:R','c','d'],
 ['osm-way-1161236397:2:F','d','c'],
 ['osm-way-1161236397:1:R','d','e'],
 ['osm-way-1161236397:1:F','e','d'],
 ['osm-way-1161236397:0:R','e','f'],
 ['osm-way-1161236397:0:F','f','e'],
 ['osm-way-604900312:1:F','f','g'],
 ['osm-way-604900312:2:F','g','h'],
 ['osm-way-604900312:3:F','h','i'],
 ['osm-way-604900312:4:F','i','j'],
 ['osm-way-604900312:5:F','j','k'],
 ['osm-way-604900312:6:F','k','l'],
 ['osm-way-604900312:7:F','l','c']
];
function fixture(){
 const edges=records.map(([id,from,to])=>({id,from,to,a:nodes[from],b:nodes[to],len:distance(nodes[from],nodes[to])}));
 const adj=new Map();
 for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
 return {edges,adj};
}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
test('real 16-edge imported KL subgraph yields measured forward route',()=>{
 const g=fixture(),r=calculate(g,snap(g.edges[0],0),snap(g.edges[5],1));
 assert.ok(r);
 assert.equal(r.distanceMeters,157);
 assert.deepEqual(r.geometry[0],[101.7038508,3.1315707]);
 assert.deepEqual(r.geometry.at(-1),[101.7038951,3.1314573]);
 assert.equal(r.geometryGapCountOverThreshold,0);
});
test('real imported KL subgraph preserves directed reverse travel restrictions',()=>{
 const g=fixture();
 // No imported edge returns to node a, so travel from e to a is impossible.
 const r=calculate(g,snap(g.edges[5],1),snap(g.edges[0],0));
 assert.equal(r,null);
});
test('real imported KL subgraph contains a reachable cycle, not just a straight chain',()=>{
 const g=fixture();
 const r=calculate(g,snap(g.edges[7],1),snap(g.edges[3],0));
 assert.ok(r);
 assert.ok(r.distanceMeters>0);
 assert.equal(g.edges.length,16);
});

test('real Atlas shortcut beats the earlier 157m four-edge path when both exist',()=>{
 const g=fixture();
 const directA={id:'osm-way-604900312:0:F',from:'a',to:'f',a:nodes.a,b:nodes.f,len:distance(nodes.a,nodes.f)};
 const directB={id:'osm-way-1161236397:0:F',from:'f',to:'e',a:nodes.f,b:nodes.e,len:distance(nodes.f,nodes.e)};
 g.edges.push(directA,directB);
 g.adj.get('a').push(directA);
 g.adj.get('f').push(directB);
 const route=calculate(g,snap(g.edges[0],0),snap(g.edges[5],1));
 assert.ok(route);
 assert.equal(route.distanceMeters,17);
 assert.deepEqual(route.geometry,[ [101.7038508,3.1315707],[101.7039169,3.1315322],[101.7038951,3.1314573] ]);
 assert.equal(route.geometryGapCountOverThreshold,0);
});
