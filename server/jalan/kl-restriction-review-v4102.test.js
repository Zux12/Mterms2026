'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessRestrictionReview}=require('./kl-restriction-review-v4102');
const complete={restrictionId:'osm-relation-10341546',status:'verified',
 evidenceRefs:['osm:relation/10341546','field:inspection/2026-11-12'],
 reviewerId:'independent-reviewer',reviewedAt:'2026-11-12T08:00:00+08:00',
 sourceVersion:'2026-11-08',restrictionType:'no_right_turn',
 timezone:'Asia/Kuala_Lumpur',roadAccessChecked:true,turnGeometryChecked:true,
 conditionalRulesChecked:true};
test('incomplete or pending review cannot be accepted',()=>{
 const r=assessRestrictionReview([{...complete,status:'pending'}]);
 assert.equal(r.accepted,0);assert.equal(r.productionRoutingAuthorized,false);
});
test('two distinct evidence references and explicit road checks required',()=>{
 assert.equal(assessRestrictionReview([{...complete,evidenceRefs:['osm:relation/10341546']}]).accepted,0);
 assert.equal(assessRestrictionReview([{...complete,roadAccessChecked:false}]).accepted,0);
 assert.equal(assessRestrictionReview([{...complete,timezone:'UTC'}]).accepted,0);
});
test('complete offline review does not activate turn enforcement or edit Atlas',()=>{
 const r=assessRestrictionReview([complete]);
 assert.equal(r.accepted,1);assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.atlasRecordsUpdated,false);assert.equal(r.productionRoutingAuthorized,false);
});
test('duplicate and malformed review records rejected',()=>{
 assert.throws(()=>assessRestrictionReview([complete,complete]),/duplicate/);
 assert.throws(()=>assessRestrictionReview([{...complete,status:'approved'}]),/status/);
});

test('self-declared complete review is never proof of independently verified road legality',()=>{
 const r=assessRestrictionReview([complete]);
 assert.equal(r.accepted,1);
 assert.equal(r.independentVerificationEstablished,false);
 assert.equal(r.results[0].independentVerificationEstablished,false);
 assert.equal(r.results[0].reason,'self-reported-evidence-complete-external-verification-required');
 assert.equal(r.productionRoutingAuthorized,false);
});
