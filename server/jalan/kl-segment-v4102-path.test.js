'use strict';
// Additional shortest-path and route-shape regression tests.
const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681],D=[3.141,101.68];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=edges=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges};};
test('chooses shorter directed path over longer alternative',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C),cd=edge('cd','c','d',C,D),da=edge('da','d','a',D,A),ac=edge('ac','a','c',A,C);
 const g=graph([ab,bc,cd,da,ac]);
 const r=calculate(g,snap(da,1),snap(cd,0));
 assert.ok(r);
 assert.equal(r.edgeCount,3); // zero-length partial edges around direct ac
 assert.ok(Math.abs(r.distanceMeters-ac.len)<2);
});
test('returned geometry is longitude-latitude and has at least two positions',()=>{
 const ab=edge('ab','a','b',A,B),bc=edge('bc','b','c',B,C);
 const r=calculate(graph([ab,bc]),snap(ab,.5),snap(bc,.5));
 assert.ok(r);
 assert.ok(r.geometry.length>=2);
 for(const p of r.geometry){assert.equal(p.length,2);assert.ok(p[0]>100&&p[0]<103);assert.ok(p[1]>2&&p[1]<4);}
 for(let i=1;i<r.geometry.length;i++)assert.notDeepEqual(r.geometry[i],r.geometry[i-1]);
});
