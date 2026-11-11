'use strict';
// KL GPS snap boundary checks; read-only isolated preview.
const test=require('node:test');
const assert=require('node:assert/strict');
const {nearest,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681];
const edge=(id,a=A,b=B)=>({id,from:id+'a',to:id+'b',a,b,len:distance(a,b)});
test('GPS point directly on segment snaps with near-zero error',()=>{
 const result=nearest([edge('ab')],[3.14,101.6805]);
 assert.ok(result);assert.ok(result.meters<.01);
 assert.equal(result.candidatesWithin200,1);
 assert.equal(result.ambiguousSnap,false);
});
test('two coincident directed edges are marked ambiguous',()=>{
 const result=nearest([edge('east'),edge('west',B,A)],[3.14,101.6805]);
 assert.ok(result);assert.equal(result.candidatesWithin200,2);
 assert.equal(result.ambiguousSnap,true);
});
test('distant candidate does not create false ambiguity',()=>{
 const far=edge('far',[3.15,101.68],[3.15,101.681]);
 const result=nearest([edge('near'),far],[3.14,101.6805]);
 assert.ok(result);assert.equal(result.candidatesWithin200,1);
 assert.equal(result.ambiguousSnap,false);
});
test('no nearby road candidate reports no match',()=>{
 assert.equal(nearest([],A),null);
});
