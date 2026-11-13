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
 assert.equal(a.strongInternalEdgeCount,0);
 assert.equal(a.strongCrossComponentEdgeCount,3);
 assert.equal(a.strongInternalEdgeShare,0);
 assert.equal(a.roadLegalityVerified,false);
});
test('a directed cycle forms one strong component',()=>{
 const a=audit([edge('A','B'),edge('B','C'),edge('C','A')]);
 assert.equal(a.strongComponentCount,1);
 assert.equal(a.strongLargestComponentNodes,3);
 assert.equal(a.strongSingletonComponentCount,0);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
 assert.equal(a.strongInternalEdgeCount,3);
 assert.equal(a.strongCrossComponentEdgeCount,0);
 assert.equal(a.strongInternalEdgeShare,1);
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
  assert.equal(a.strongInternalEdgeCount,null);
  assert.equal(a.strongCrossComponentEdgeCount,null);
  assert.equal(a.strongInternalEdgeShare,null);
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

test('SCC diagnostics distinguish internal two-way cores from one-way bridges',()=>{
 const e=[edge('A','B'),edge('B','A'),edge('B','C'),
  edge('C','D'),edge('D','C'),edge('D','E')];
 const a=audit(e);
 assert.equal(a.strongComponentCount,3);
 assert.equal(a.strongInternalEdgeCount,4);
 assert.equal(a.strongCrossComponentEdgeCount,2);
 assert.equal(a.strongInternalEdgeShare,4/6);
 assert.equal(a.strongSourceComponentCount,1);
 assert.equal(a.strongSinkComponentCount,1);
 assert.equal(a.roadLegalityVerified,false);
});

test('seeded independent reachability oracle cross-checks SCC edge and condensation counts',()=>{
 // Independent transitive-closure oracle, intentionally not based on DFS order.
 let seed=0x4a414c41;
 function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 for(let trial=0;trial<120;trial++){
  const n=2+Math.floor(random()*7),m=1+Math.floor(random()*35),edges=[];
  for(let i=0;i<m;i++)edges.push(edge('N'+Math.floor(random()*n),'N'+Math.floor(random()*n)));
  const v=[...new Set(edges.flatMap(x=>[x.from,x.to]))];
  const indexes=new Map(v.map((x,i)=>[x,i]));
  const reach=Array.from({length:v.length},(_,i)=>Array.from({length:v.length},(_,j)=>i===j));
  for(const e of edges)reach[indexes.get(e.from)][indexes.get(e.to)]=true;
  for(let k=0;k<v.length;k++)for(let i=0;i<v.length;i++)for(let j=0;j<v.length;j++)
   reach[i][j] ||= reach[i][k]&&reach[k][j];
  const group=new Array(v.length).fill(-1),sizes=[];
  for(let i=0;i<v.length;i++){
   if(group[i]>=0)continue;
   const g=sizes.length;let size=0;
   for(let j=0;j<v.length;j++)if(reach[i][j]&&reach[j][i]){
    group[j]=g;size++;
   }
   sizes.push(size);
  }
  const incoming=new Set(),outgoing=new Set();
  let internal=0,cross=0;
  for(const e of edges){
   const a=group[indexes.get(e.from)],b=group[indexes.get(e.to)];
   if(a===b)internal++;else{cross++;outgoing.add(a);incoming.add(b);}
  }
  const got=audit(edges),prefix='trial '+trial+': ';
  assert.equal(got.strongConnectivityAvailable,true,prefix+'available');
  assert.equal(got.strongNodeCount,v.length,prefix+'nodes');
  assert.equal(got.strongEdgeCount,edges.length,prefix+'edges');
  assert.equal(got.strongComponentCount,sizes.length,prefix+'components');
  assert.equal(got.strongLargestComponentNodes,Math.max(...sizes),prefix+'largest');
  assert.equal(got.strongSingletonComponentCount,sizes.filter(x=>x===1).length,prefix+'singletons');
  assert.equal(got.strongSourceComponentCount,sizes.length-incoming.size,prefix+'sources');
  assert.equal(got.strongSinkComponentCount,sizes.length-outgoing.size,prefix+'sinks');
  assert.equal(got.strongInternalEdgeCount,internal,prefix+'internal');
  assert.equal(got.strongCrossComponentEdgeCount,cross,prefix+'cross');
  assert.equal(got.strongInternalEdgeShare,internal/edges.length,prefix+'share');
 }
});
