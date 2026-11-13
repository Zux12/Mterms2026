'use strict';
// Synthetic graph QA for the isolated KL experimental preview. No DB/network.
const test=require('node:test');
const assert=require('node:assert/strict');
const {graphDiagnostics,calculate,distance}=require('./kl-segment-v4102');
const P={A:[3.14,101.68],B:[3.14,101.681],C:[3.141,101.681],
 D:[3.141,101.68],E:[3.142,101.68],F:[3.142,101.681]};
const edge=(from,to)=>({id:from+'-'+to,from,to,a:P[from],b:P[to],
 len:distance(P[from],P[to])});
function graph(edges){const adj=new Map();for(const e of edges){
 if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);
}return {edges,adj};}
const snap=(e,t)=>({edge:e,t,point:[
 e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});

test('cached graph summaries distinguish weak connection from directed strong reachability',()=>{
 const edges=[edge('A','B'),edge('B','A'),edge('B','C'),edge('C','D'),edge('D','C')];
 const d=graphDiagnostics(edges);
 assert.equal(d.topology.graphTopologyAvailable,true);
 assert.equal(d.topology.topologyWeakComponentCount,1);
 assert.equal(d.strongTopology.strongConnectivityAvailable,true);
 assert.equal(d.strongTopology.strongComponentCount,2);
 assert.equal(d.strongTopology.strongLargestComponentNodes,2);
 assert.equal(d.strongTopology.strongInternalEdgeCount,4);
 assert.equal(d.strongTopology.strongCrossComponentEdgeCount,1);
 assert.equal(d.strongTopology.strongInternalEdgeShare,4/5);
 assert.equal(d.strongTopology.strongSourceComponentCount,1);
 assert.equal(d.strongTopology.strongSinkComponentCount,1);
 assert.equal(d.strongTopology.strongConnectivityAdvisoryOnly,true);
 assert.equal(d.strongTopology.roadLegalityVerified,false);
 assert.equal(d.topology.directedReachabilityVerified,false);
});

test('separate two-way islands are not misrepresented as one reachable road network',()=>{
 const d=graphDiagnostics([edge('A','B'),edge('B','A'),edge('E','F'),edge('F','E')]);
 assert.equal(d.topology.topologyWeakComponentCount,2);
 assert.equal(d.strongTopology.strongComponentCount,2);
 assert.equal(d.strongTopology.strongSourceComponentCount,2);
 assert.equal(d.strongTopology.strongSinkComponentCount,2);
});

test('directed strong-component warning cannot turn a reverse-unreachable trip into a route',()=>{
 const edges=[edge('A','B'),edge('B','A'),edge('B','C'),edge('C','D'),edge('D','C')];
 const g=graph(edges),d=graphDiagnostics(edges);
 assert.equal(d.strongTopology.strongComponentCount,2);
 assert.ok(calculate(g,snap(edges[0],0),snap(edges[3],1)));
 assert.equal(calculate(g,snap(edges[3],1),snap(edges[0],0)),null);
});

test('invalid imported topology remains unknown rather than falsely reporting safety',()=>{
 const invalid=[edge('A','B'),{...edge('B','C'),to:''}];
 const d=graphDiagnostics(invalid);
 assert.equal(d.topology.graphTopologyAvailable,false);
 assert.equal(d.strongTopology.strongConnectivityAvailable,false);
 assert.equal(d.strongTopology.strongComponentCount,null);
 assert.equal(d.strongTopology.roadLegalityVerified,false);
 assert.equal(d.nodeGeometry.graphNodeGeometryReviewAvailable,false);
});

test('empty graph reports unavailable strong and weak diagnostics',()=>{
 const d=graphDiagnostics([]);
 assert.equal(d.topology.graphTopologyAvailable,false);
 assert.equal(d.strongTopology.strongConnectivityAvailable,false);
 assert.equal(d.strongTopology.strongComponentCount,null);
 assert.equal(d.nodeGeometry.graphNodeGeometryReviewAvailable,false);
});
