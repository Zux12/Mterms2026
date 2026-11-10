'use strict';
// Differential routing regression: compare directed shortest paths with an independent
// Bellman-Ford reference on deterministic small graphs. No MongoDB or live traffic.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
function reference(edges,start,end){
 const dist=Array.from({length:Math.max(start,end,...edges.flatMap(e=>[Number(e.from),Number(e.to)]))+1},()=>Infinity);dist[start]=0;
 for(let k=0;k<dist.length-1;k++){let changed=false;for(const e of edges){
  const a=Number(e.from),b=Number(e.to);
  if(dist[a]+e.len<dist[b]){dist[b]=dist[a]+e.len;changed=true;}
 }if(!changed)break;}
 return Number.isFinite(dist[end])?dist[end]:null;
}
function seeded(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('directed Dijkstra agrees with independent Bellman-Ford over 40 seeded networks',()=>{
 for(let trial=0;trial<40;trial++){
  const random=seeded(1000+trial),N=12,points=Array.from({length:N},(_,i)=>[3.1+i*.001,101.6+(i%3)*.001]);
  const edges=[];let id=0;
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
   if(i!==j&&random()<.17)edges.push({id:String(id++),from:String(i),to:String(j),a:points[i],b:points[j],len:distance(points[i],points[j])});
  }
  // Virtual start/end partial legs must be included in the reference.
  const start=edges.find(e=>e.from==='0'),end=edges.find(e=>e.to==='11');
  if(!start||!end)continue;
  const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
  const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
  const actual=calculate({edges,adj},snap(start,0),snap(end,1));
  const referenceEdges=[...edges,
   {from:'12',to:start.to,len:start.len},
   {from:end.from,to:'13',len:end.len}];
  // The router starts by traversing its selected start edge and ends by
  // traversing its selected destination edge; model both explicitly.
  const expected=reference(referenceEdges,12,13);
  assert.equal(actual===null,expected===null,'trial '+trial);
  if(expected!==null)assert.ok(Math.abs(actual.distanceMeters-expected)<2,'trial '+trial);
 }
});
