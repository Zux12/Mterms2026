'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {assessEvidencePackage}=require('./kl-restriction-evidence-package-v4102');
const id='osm-relation-10341546';
const artifacts=[
 {artifactId:'osm_source_001',sha256:'a'.repeat(64),sourceType:'osm-snapshot',
 capturedAt:'2026-11-12T08:00:00+08:00',reference:'osm:relation/10341546'},
 {artifactId:'authority_001',sha256:'b'.repeat(64),sourceType:'road-authority',
 capturedAt:'2026-11-12T08:00:00+08:00',reference:'authority:placeholder'}];
const manifest={restrictionId:id,artifacts};
const review={restrictionId:id,status:'verified',evidenceRefs:artifacts.map(a=>a.reference),
 reviewerId:'reviewer-one',reviewedAt:'2026-11-12T08:00:00+08:00',
 sourceVersion:'2026-11-08',restrictionType:'no_right_turn',
 timezone:'Asia/Kuala_Lumpur',roadAccessChecked:true,turnGeometryChecked:true,
 conditionalRulesChecked:true};
const external={restrictionId:id,artifactId:'authority_001',sourceType:'road-authority',
 reviewerId:'reviewer-two',reviewedAt:'2026-11-12T08:00:00+08:00',
 sourceReference:'authority:placeholder',sourceIdentityChecked:true,
 locationMatchChecked:true,directionMatchChecked:true,currentValidityChecked:true,
 restrictionSemanticsChecked:true};
test('joined complete checklists still never authorize legal driving routes',()=>{
 const r=assessEvidencePackage([review],[manifest],[external]);
 assert.equal(r.packageMetadataComplete,1);
 assert.equal(r.independentVerificationEstablished,false);
 assert.equal(r.legalDrivingRouteVerified,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('missing or incomplete external checklist fails closed',()=>{
 assert.equal(assessEvidencePackage([review],[manifest],[]).packageMetadataComplete,0);
 assert.equal(assessEvidencePackage([review],[manifest],[{...external,directionMatchChecked:false}]).packageMetadataComplete,0);
});
test('external checklist must match manifest artifact identity and source type',()=>{
 assert.throws(()=>assessEvidencePackage([review],[manifest],[{...external,artifactId:'unlinked_001'}]),/not linked/);
 assert.throws(()=>assessEvidencePackage([review],[manifest],[{...external,sourceType:'field-photo'}]),/not linked/);
});
