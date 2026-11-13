'use strict';
// Synthetic, read-only diagnostics. Visited search states are not proof of
// full-graph reachability, road legality or route acceptance.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance,noPathResponse}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.68],D=[3.141,101.681];
function edge(id,from,to,a,b){return {id,from,to,a,b,len:distance(a,b)};}
function graph(edges){
 const adj=new Map();
 for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
 return {edges,adj};
}
function snap(e,t){
 return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};
}
test('disconnected experimental search returns no route and a measured visited-state count',()=>{
 const ab=edge('ab','a','b',A,B),cd=edge('cd','c','d',C,D);
 const diagnostics={};
 assert.equal(calculate(graph([ab,cd]),snap(ab,.5),snap(cd,.5),diagnostics),null);
 assert.equal(diagnostics.visited,2); // @start and b; no graph transition to c
 const reply=noPathResponse({graphLoad:0,snapping:1,pathSearch:3,total:4},diagnostics.visited);
 assert.equal(reply.searchVisitedNodes,2);
 assert.equal(reply.routingActivated,false);
 assert.equal(reply.databaseWrites,0);
});
test('successful search retains the same visited count with optional diagnostics',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const diagnostics={};
 const route=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5),diagnostics);
 assert.ok(route);
 assert.equal(diagnostics.visited,route.visited);
 assert.ok(diagnostics.visited>0);
});
test('no-path response does not reflect malformed or sensitive diagnostic values',()=>{
 for(const bad of ['PRIVATE_GPS_TOKEN',{},[],Infinity,NaN,-1,1.5,400001,1000000,Number.MAX_SAFE_INTEGER+1]){
  const reply=noPathResponse({graphLoad:0,snapping:0,pathSearch:1,total:1},bad);
  assert.equal(reply.searchVisitedNodes,null);
  assert.ok(!JSON.stringify(reply).includes('PRIVATE_GPS_TOKEN'));
 }
 assert.equal(noPathResponse({total:1}).searchVisitedNodes,null);
});

test('no-path replies tag complete graph provenance only when v495 cardinality is supplied',()=>{
 const time={graphLoad:1,snapping:1,pathSearch:1,total:3};
 const complete=noPathResponse(time,100,168221);
 assert.equal(complete.graphEdges,168221);
 assert.equal(complete.graphVersion,'road_graph_edges_v495');
 assert.equal(complete.searchVisitedNodes,100);
 for(const n of [null,1000,-1,'168221',168222]){
  const incomplete=noPathResponse(time,100,n);
  assert.equal(incomplete.graphEdges,null);
 }
});

test('no-path response reports cold and warm graph state without reflecting untrusted metadata',()=>{
 const time={graphLoad:10,snapping:2,pathSearch:8,total:20};
 for(const cached of [false,true]){
  const reply=noPathResponse(time,100,168221,cached);
  assert.equal(reply.graphCacheHit,cached);
  assert.equal(reply.graphEdges,168221);
 }
 for(const invalid of [undefined,null,0,1,'true',{secret:'SECRET_CACHE_METADATA'}]){
  const reply=noPathResponse(time,100,168221,invalid);
  assert.equal(reply.graphCacheHit,null);
  assert.ok(!JSON.stringify(reply).includes('SECRET_CACHE_METADATA'));
 }
});
