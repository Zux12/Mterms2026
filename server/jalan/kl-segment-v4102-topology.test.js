'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditDirectedGraphTopology:audit}=require('./kl-graph-topology-audit-v4102');
const edge=(from,to)=>({from,to});

test('one-way chain reports source and sink but one weak component',()=>{
 const a=audit([edge('A','B'),edge('B','C')]);
 assert.deepEqual({source:a.topologySourceOnlyNodes,sink:a.topologySinkOnlyNodes,
  comps:a.topologyWeakComponentCount,nodes:a.topologyNodeCount,edges:a.topologyEdgeCount},
  {source:1,sink:1,comps:1,nodes:3,edges:2});
 assert.equal(a.topologyLargestWeakComponentShare,1);
 assert.equal(a.directedReachabilityVerified,false);
});
test('directed cycle has no source-only or sink-only nodes',()=>{
 const a=audit([edge('A','B'),edge('B','C'),edge('C','A')]);
 assert.equal(a.topologySourceOnlyNodes,0);
 assert.equal(a.topologySinkOnlyNodes,0);
 assert.equal(a.topologyWeakComponentCount,1);
});
test('disconnected road fragments are separate weak components',()=>{
 const a=audit([edge('A','B'),edge('B','C'),edge('X','Y')]);
 assert.equal(a.topologyWeakComponentCount,2);
 assert.equal(a.topologySmallWeakComponentCount,2);
 assert.equal(a.topologyLargestWeakComponentNodes,3);
 assert.equal(a.topologyLargestWeakComponentEdges,2);
 assert.equal(a.topologyLargestWeakComponentShare,3/5);
 assert.equal(a.topologySourceOnlyNodes,2);
 assert.equal(a.topologySinkOnlyNodes,2);
});
test('two opposite directed edges are not mistaken for a source or a sink',()=>{
 const a=audit([edge('1','2'),edge('2','1')]);
 assert.equal(a.topologySourceOnlyNodes,0);
 assert.equal(a.topologySinkOnlyNodes,0);
 assert.equal(a.topologyLargestWeakComponentEdges,2);
});
test('self-loop and duplicate arcs do not inflate component or node counts',()=>{
 const a=audit([edge('A','A'),edge('A','B'),edge('A','B')]);
 assert.equal(a.topologyNodeCount,2);
 assert.equal(a.topologyWeakComponentCount,1);
 assert.equal(a.topologySourceOnlyNodes,0);
 assert.equal(a.topologySinkOnlyNodes,1);
 assert.equal(a.topologyEdgeCount,3);
});
test('malformed and empty imports never masquerade as zero connectivity warnings',()=>{
 for(const data of [[],null,[edge('A','')],[edge(null,'A')],[null],[edge('A','B'),{}]]){
  const a=audit(data);
  assert.equal(a.graphTopologyAvailable,false);
  assert.equal(a.topologyWeakComponentCount,null);
  assert.equal(a.topologySourceOnlyNodes,null);
  assert.equal(a.topologyLargestWeakComponentShare,null);
  assert.equal(a.topologyAdvisoryOnly,true);
  assert.equal(a.directedReachabilityVerified,false);
 }
});
test('long one-way chain is processed without recursive traversal',()=>{
 const n=5000,edges=Array.from({length:n},(_,i)=>edge('N'+i,'N'+(i+1)));
 const a=audit(edges);
 assert.equal(a.graphTopologyAvailable,true);
 assert.equal(a.topologyNodeCount,n+1);
 assert.equal(a.topologyWeakComponentCount,1);
 assert.equal(a.topologySourceOnlyNodes,1);
 assert.equal(a.topologySinkOnlyNodes,1);
 assert.equal(a.topologyLargestWeakComponentEdges,n);
});
