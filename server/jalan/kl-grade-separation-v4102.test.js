'use strict';
// Grade-separated roads may cross in 2D without sharing an OSM graph node.
// This tests graph connectivity, not the legality of any real-world junction.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance,nearest}=require('./kl-segment-v4102');
function edge(id,from,to,a,b){return {id,from,to,a,b,len:distance(a,b)};}
function graph(edges){const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {edges,adj};}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
const west=[3.14,101.679],east=[3.14,101.681];
const south=[3.139,101.680],north=[3.141,101.680];
test('overpass crossing without shared graph node cannot teleport to lower road',()=>{
 const over= edge('bridge','bridge-west','bridge-east',west,east);
 const under=edge('ground','ground-south','ground-north',south,north);
 const g=graph([over,under]);
 assert.equal(calculate(g,snap(over,0.25),snap(under,0.75)),null);
 assert.equal(calculate(g,snap(under,0.25),snap(over,0.75)),null);
});
test('explicit graph junction enables crossing-road transfer only when connected',()=>{
 const junction=[3.14,101.680];
 const g=graph([
  edge('over-in','w','j',west,junction),
  edge('under-out','j','n',junction,north)
 ]);
 const route=calculate(g,snap(g.edges[0],0.25),snap(g.edges[1],0.75));
 assert.ok(route);
 assert.equal(route.geometryGapCountOverThreshold,0);
});
test('nearby parallel unconnected edges are not treated as legal reverse twins',()=>{
 const a=edge('bridge','a','b',west,east);
 const b=edge('other-level','c','d',east,west);
 const g=graph([a,b]);
 const found=nearest(g.edges,[3.14,101.680]);
 assert.equal(found.reverseTwin,null);
 assert.equal(found.ambiguousSnap,true);
 assert.equal(calculate(g,snap(a,0.2),snap(b,0.8)),null);
});
