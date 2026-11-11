'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditStrongComponents:audit}=require('./kl-strong-components-audit-v4102');
const edge=(from,to)=>({from,to});

test('a one-way corridor is weakly connected but has separate strong components',()=>{
 const a=audit([edge('A','B'),edge('B','C'),edge('C','D')]);
 assert.equal(a.strongConnectivityAvailable,true);
 assert.equal(a.strongNodeCount,4);
 assert.equal(a.strongEdgeCount,3);
 assert.equal(a.strongComponentCount,4);
 assert.equal(a.strongSingletonComponentCount,4);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
 assert.equal(a.strongLargestComponentShare,0.25);
 assert.equal(a.roadLegalityVerified,false);
});
test('a directed cycle forms one strong component',()=>{
 const a=audit([edge('A','B'),edge('B','C'),edge('C','A')]);
 assert.equal(a.strongComponentCount,1);
 assert.equal(a.strongLargestComponentNodes,3);
 assert.equal(a.strongSingletonComponentCount,0);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
});
test('one-way bridge between cycles prevents reverse directed reachability',()=>{
 const a=audit([edge('A','B'),edge('B','A'),edge('B','C'),
  edge('C','D'),edge('D','C')]);
 assert.equal(a.strongComponentCount,2);
 assert.equal(a.strongLargestComponentNodes,2);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
});
test('two disconnected bidirectional islands yield two independent components',()=>{
 const a=audit([edge('A','B'),edge('B','A'),edge('C','D'),edge('D','C')]);
 assert.equal(a.strongComponentCount,2);
 assert.equal(a.strongSingletonComponentCount,0);
 assert.equal(a.strongSourceComponentCount,2);
 assert.equal(a.strongSinkComponentCount,2);
});
test('duplicate arcs and self loops do not create fake strong connections',()=>{
 const a=audit([edge('A','A'),edge('A','B'),edge('A','B')]);
 assert.equal(a.strongNodeCount,2);
 assert.equal(a.strongComponentCount,2);
 assert.equal(a.strongSingletonComponentCount,2);
});
test('malformed or empty data reports unknown instead of zero components',()=>{
 for(const edges of [[],null,[null],[edge('', 'B')],[edge('A',null)],
  [edge('A','B'),{from:'C'}]]){
  const a=audit(edges);
  assert.equal(a.strongConnectivityAvailable,false);
  assert.equal(a.strongComponentCount,null);
  assert.equal(a.strongLargestComponentShare,null);
  assert.equal(a.strongConnectivityAdvisoryOnly,true);
  assert.equal(a.roadLegalityVerified,false);
 }
});
test('large one-way chain uses iterative traversals, not recursive DFS',()=>{
 const count=12000;
 const edges=Array.from({length:count},(_,i)=>edge('N'+i,'N'+(i+1)));
 const a=audit(edges);
 assert.equal(a.strongConnectivityAvailable,true);
 assert.equal(a.strongComponentCount,count+1);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
 assert.equal(a.strongLargestComponentNodes,1);
});
