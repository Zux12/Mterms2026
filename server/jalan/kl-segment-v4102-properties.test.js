'use strict';
// Route properties across deterministic directed chains.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const point=i=>[3.1+i*.0003,101.6+i*.0002];
function make(n){
 const edges=[],adj=new Map();
 for(let i=0;i<n;i++){const a=point(i),b=point(i+1),e={id:'e'+i,from:String(i),to:String(i+1),a,b,len:distance(a,b)};edges.push(e);adj.set(e.from,[e]);}
 return {edges,adj};
}
function snap(e,t){return {edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]};}
test('route distance is monotonic for successive destinations on a directed chain',()=>{
 const g=make(25),start=snap(g.edges[0],0);
 let previous=-1;
 for(let i=0;i<25;i++){
  const r=calculate(g,start,snap(g.edges[i],1));
  assert.ok(r);
  assert.ok(r.distanceMeters>=previous,'destination '+i);
  previous=r.distanceMeters;
  assert.ok(r.geometry.length>=2);
 }
});
test('reverse direction is unreachable on a strictly one-way chain',()=>{
 const g=make(25);
 assert.equal(calculate(g,snap(g.edges[24],1),snap(g.edges[0],0)),null);
});
