'use strict';
// Defensive tests for numeric projection and edge direction on real-world-like coordinates.
const test=require('node:test');
const assert=require('node:assert/strict');
const {project,distance}=require('./kl-segment-v4102');
test('projection is finite on zero-length segments',()=>{
 const a=[3.14,101.68],p=[3.14001,101.68001],r=project(p,a,a);
 assert.equal(r.t,0);assert.deepEqual(r.point,a);assert.ok(Number.isFinite(r.meters));
});
test('projection returns exact endpoints when GPS lies outside segment',()=>{
 const a=[3.14,101.68],b=[3.14,101.681];
 assert.deepEqual(project([3.14,101.679],a,b).point,a);
 assert.deepEqual(project([3.14,101.682],a,b).point,b);
});
test('haversine distance is symmetric and zero for identical coordinates',()=>{
 const a=[3.14,101.68],b=[3.15,101.69];
 assert.equal(distance(a,a),0);
 assert.ok(Math.abs(distance(a,b)-distance(b,a))<1e-8);
});
