'use strict';
// Offline evidence manifest validator: provenance and tamper-evident digest
// only. Does NOT attest that photographs, signs, OSM tags or reviews are true.
const {createHash}=require('node:crypto');
const ID=/^osm-relation-\d+$/;
const SHA=/^[a-f0-9]{64}$/;
function validateEvidenceManifest(manifest){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||
   !ID.test(manifest.restrictionId||'')||
   !Array.isArray(manifest.artifacts)||manifest.artifacts.length<2)
  throw Error('Invalid restriction evidence manifest');
 const seen=new Set(),seenHashes=new Set(),seenReferences=new Set(),sources=new Set();
 const artifacts=manifest.artifacts.map(a=>{
  if(!a||typeof a!=='object'||Array.isArray(a)||
    !/^[a-zA-Z0-9_-]{5,80}$/.test(a.artifactId||'')||
    seen.has(a.artifactId)||!SHA.test(a.sha256||'')||
    seenHashes.has(a.sha256)||seenReferences.has(a.reference)||
    !['osm-snapshot','field-photo','road-authority','independent-map','review-note'].includes(a.sourceType)||
    typeof a.capturedAt!=='string'||!Number.isFinite(Date.parse(a.capturedAt))||
    typeof a.reference!=='string'||a.reference.length<5||a.reference.length>200)
   throw Error('Invalid evidence artifact metadata');
  seen.add(a.artifactId);seenHashes.add(a.sha256);seenReferences.add(a.reference);
  sources.add(a.sourceType);
  return {artifactId:a.artifactId,sha256:a.sha256,sourceType:a.sourceType,
   capturedAt:a.capturedAt,reference:a.reference};
 });
 // Stable digest over whitelisted metadata only; no images, GPS traces or credentials.
 artifacts.sort((a,b)=>a.artifactId.localeCompare(b.artifactId));
 const canonical=JSON.stringify({restrictionId:manifest.restrictionId,artifacts});
 const manifestSha256=createHash('sha256').update(canonical).digest('hex');
 const sourceDiversity=sources.size>=2;
 return {restrictionId:manifest.restrictionId,artifactCount:artifacts.length,
  sourceTypes:[...sources].sort(),sourceDiversity,manifestSha256,
  metadataComplete:true,independentVerificationEstablished:false,
  turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
module.exports={validateEvidenceManifest};
