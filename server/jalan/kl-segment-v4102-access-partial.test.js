'use strict';
// More conservative access diagnostics: values are advisory, not legal permission.
const test=require('node:test');
const assert=require('node:assert/strict');
const {accessCaution,calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681];
const edge=(caution)=>({id:'ab',from:'a',to:'b',a:A,b:B,len:distance(A,B),potentialAccessCaution:caution});
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=e=>({edges:[e],adj:new Map([['a',[e]]])});
test('access caution is case insensitive and covers each tag field',()=>{
 for(const field of ['access','vehicle','motorVehicle']){
  assert.equal(accessCaution({[field]:'DeStInAtIoN'}),true);
  assert.equal(accessCaution({[field]:'customers'}),true);
 }
});
test('same-edge partial route retains access caution',()=>{
 const e=edge(true),r=calculate(graph(e),snap(e,.2),snap(e,.8));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,1);
});
test('unrestricted same-edge partial route has no caution',()=>{
 const e=edge(false),r=calculate(graph(e),snap(e,.2),snap(e,.8));
 assert.ok(r);assert.equal(r.potentialAccessReviewEdges,0);
});
