'use strict';
// Synthetic integrity tests: graph cardinality alone does not prove unique IDs.
// The actual KL v495 collection is audited separately with read-only queries.
const test=require('node:test');
const assert=require('node:assert/strict');
const {createEdgeIdGuard}=require('./kl-edge-identity-v4102');
test('distinct directed forward/reverse arcs have distinct valid IDs',()=>{
 const ids=createEdgeIdGuard();
 ids.record('osm-way-123:0:F');
 ids.record('osm-way-123:0:R');
 assert.equal(ids.checked,2);
});
test('repeated ID is rejected despite a matching total collection count',()=>{
 const ids=createEdgeIdGuard();
 ids.record('osm-way-123:0:F');
 assert.throws(()=>ids.record('osm-way-123:0:F'),/Duplicate directed edge ID/);
 assert.equal(ids.checked,1);
});
test('duplicate ID cannot be accepted merely because its graph endpoints differ',()=>{
 const ids=createEdgeIdGuard();
 const edges=[{id:'same',from:'a',to:'b'},{id:'same',from:'c',to:'d'}];
 ids.record(edges[0].id);
 assert.throws(()=>ids.record(edges[1].id),/Duplicate directed edge ID/);
});
test('null, empty, whitespace, and non-string IDs are invalid',()=>{
 for(const bad of [null,undefined,'','   ',123]){
  const ids=createEdgeIdGuard();
  assert.throws(()=>ids.record(bad),/Invalid directed edge ID/);
  assert.equal(ids.checked,0);
 }
});
test('a fresh load gets an independent uniqueness guard',()=>{
 const a=createEdgeIdGuard(),b=createEdgeIdGuard();
 a.record('osm-way-5:0:F');
 b.record('osm-way-5:0:F');
 assert.equal(a.checked,1);assert.equal(b.checked,1);
});
