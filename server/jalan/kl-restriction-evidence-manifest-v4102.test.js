'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {validateEvidenceManifest}=require('./kl-restriction-evidence-manifest-v4102');
const base={restrictionId:'osm-relation-10341546',artifacts:[
 {artifactId:'osm_source_001',sha256:'a'.repeat(64),sourceType:'osm-snapshot',
  capturedAt:'2026-11-12T08:00:00+08:00',reference:'osm:relation/10341546'},
 {artifactId:'authority_001',sha256:'b'.repeat(64),sourceType:'road-authority',
  capturedAt:'2026-11-12T08:00:00+08:00',reference:'authority:record/placeholder'}
]};
test('stable digest regardless of artifact order; never implies legal verification',()=>{
 const a=validateEvidenceManifest(base);
 const b=validateEvidenceManifest({...base,artifacts:[...base.artifacts].reverse()});
 assert.equal(a.manifestSha256,b.manifestSha256);
 assert.equal(a.sourceDiversity,true);
 assert.equal(a.independentVerificationEstablished,false);
 assert.equal(a.productionRoutingAuthorized,false);
});
test('artifact metadata changes produce a different manifest digest',()=>{
 const a=validateEvidenceManifest(base);
 const changed={...base,artifacts:[base.artifacts[0],{...base.artifacts[1],sha256:'c'.repeat(64)}]};
 assert.notEqual(a.manifestSha256,validateEvidenceManifest(changed).manifestSha256);
});
test('duplicate artifacts and invalid SHA digests are rejected',()=>{
 assert.throws(()=>validateEvidenceManifest({...base,artifacts:[base.artifacts[0],base.artifacts[0]]}),/artifact/);
 assert.throws(()=>validateEvidenceManifest({...base,artifacts:[base.artifacts[0],{...base.artifacts[1],sha256:'fake'}]}),/artifact/);
});
test('two metadata artifacts from one source are not independent evidence',()=>{
 const r=validateEvidenceManifest({...base,artifacts:[base.artifacts[0],
  {...base.artifacts[1],sourceType:'osm-snapshot'}]});
 assert.equal(r.sourceDiversity,false);
 assert.equal(r.independentVerificationEstablished,false);
});

test('different artifact IDs cannot reuse the same evidence reference',()=>{
 const duplicate={...base,artifacts:[base.artifacts[0],
  {...base.artifacts[1],reference:base.artifacts[0].reference}]};
 assert.throws(()=>validateEvidenceManifest(duplicate),/artifact/);
});
test('identical file digest cannot masquerade as independent evidence source',()=>{
 const duplicate={...base,artifacts:[base.artifacts[0],
  {...base.artifacts[1],sha256:base.artifacts[0].sha256}]};
 assert.throws(()=>validateEvidenceManifest(duplicate),/artifact/);
});
