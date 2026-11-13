'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessExternalEvidence}=require('./kl-external-evidence-review-v4102');
const sample={restrictionId:'osm-relation-10341546',artifactId:'authority_001',
 sourceType:'road-authority',reviewerId:'independent-reviewer',
 reviewedAt:'2026-11-12T08:00:00+08:00',sourceReference:'authority:placeholder',
 sourceIdentityChecked:true,locationMatchChecked:true,directionMatchChecked:true,
 currentValidityChecked:true,restrictionSemanticsChecked:true};
test('complete checklist does not claim independent authenticity or legal route',()=>{
 const r=assessExternalEvidence([sample]);
 assert.equal(r.checklistsComplete,1);
 assert.equal(r.authenticityIndependentlyEstablished,false);
 assert.equal(r.results[0].legalDrivingRouteVerified,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('missing source identity or directional check prevents checklist completion',()=>{
 assert.equal(assessExternalEvidence([{...sample,sourceIdentityChecked:false}]).checklistsComplete,0);
 assert.equal(assessExternalEvidence([{...sample,directionMatchChecked:false}]).checklistsComplete,0);
});
test('duplicate evidence and unsupported source categories rejected',()=>{
 assert.throws(()=>assessExternalEvidence([sample,sample]),/duplicate/);
 assert.throws(()=>assessExternalEvidence([{...sample,sourceType:'review-note'}]),/Invalid/);
});
