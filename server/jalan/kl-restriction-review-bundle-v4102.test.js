'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessReviewBundle}=require('./kl-restriction-review-bundle-v4102');
const review={restrictionId:'osm-relation-10341546',status:'verified',
 evidenceRefs:['osm:relation/10341546','field:inspection/2026-11-12'],
 reviewerId:'reviewer-one',reviewedAt:'2026-11-12T08:00:00+08:00',
 sourceVersion:'2026-11-08',restrictionType:'no_right_turn',
 timezone:'Asia/Kuala_Lumpur',roadAccessChecked:true,turnGeometryChecked:true,
 conditionalRulesChecked:true};
const artifacts=[
 {artifactId:'osm_source_001',sha256:'a'.repeat(64),sourceType:'osm-snapshot',
  capturedAt:'2026-11-12T08:00:00+08:00',reference:'osm:relation/10341546'},
 {artifactId:'authority_001',sha256:'b'.repeat(64),sourceType:'road-authority',
  capturedAt:'2026-11-12T08:00:00+08:00',reference:'authority:placeholder'}
];
const manifest={restrictionId:review.restrictionId,artifacts};
test('complete metadata bundle never claims independent verification or activates routing',()=>{
 const r=assessReviewBundle([review],[manifest]);
 assert.equal(r.bundleMetadataComplete,1);
 assert.equal(r.independentVerificationEstablished,false);
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.productionRoutingAuthorized,false);
 assert.match(r.results[0].manifestSha256,/^[a-f0-9]{64}$/);
});
test('missing manifest or pending review cannot complete metadata bundle',()=>{
 assert.equal(assessReviewBundle([review],[]).bundleMetadataComplete,0);
 assert.equal(assessReviewBundle([{...review,status:'pending'}],[manifest]).bundleMetadataComplete,0);
});
test('single source type cannot count as diverse evidence',()=>{
 const m={...manifest,artifacts:[artifacts[0],{...artifacts[1],sourceType:'osm-snapshot'}]};
 assert.equal(assessReviewBundle([review],[m]).bundleMetadataComplete,0);
});
test('duplicate and orphan evidence manifests are rejected',()=>{
 assert.throws(()=>assessReviewBundle([review],[manifest,manifest]),/Duplicate/);
 assert.throws(()=>assessReviewBundle([],[manifest]),/Orphan/);
});
