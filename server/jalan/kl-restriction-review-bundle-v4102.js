'use strict';
// Offline integration of review metadata and evidence-manifest metadata.
// No evidence authenticity assertion, database writes or routing activation.
const {assessRestrictionReview}=require('./kl-restriction-review-v4102');
const {validateEvidenceManifest}=require('./kl-restriction-evidence-manifest-v4102');
function assessReviewBundle(reviewRecords,manifests){
 if(!Array.isArray(manifests))throw new TypeError('Expected evidence manifests array');
 const reviews=assessRestrictionReview(reviewRecords);
 const byId=new Map();
 for(const manifest of manifests){
  const checked=validateEvidenceManifest(manifest);
  if(byId.has(checked.restrictionId))throw Error('Duplicate restriction evidence manifest');
  byId.set(checked.restrictionId,{checked,references:new Set(manifest.artifacts.map(a=>a.reference))});
 }
 for(const id of byId.keys()){
  if(!reviews.results.some(x=>x.restrictionId===id))
   throw Error('Orphan evidence manifest');
 }
 const reviewsById=new Map(reviewRecords.map(r=>[r.restrictionId,r]));
 const results=reviews.results.map(r=>{
  const bundle=byId.get(r.restrictionId);
  const manifest=bundle?.checked;
  const declared=reviewsById.get(r.restrictionId)?.evidenceRefs;
  const referencesMatch=!!bundle&&Array.isArray(declared)&&
   declared.length===bundle.references.size&&
   declared.every(ref=>bundle.references.has(ref));
  const metadataReady=r.reviewAccepted&&!!manifest&&manifest.sourceDiversity&&referencesMatch;
  return {restrictionId:r.restrictionId,reviewMetadataComplete:r.reviewAccepted,
   evidenceMetadataComplete:!!manifest?.metadataComplete,
   evidenceSourceDiversity:!!manifest?.sourceDiversity,
   reviewEvidenceReferencesMatchManifest:!!referencesMatch,
   manifestSha256:manifest?.manifestSha256??null,
   bundleMetadataComplete:!!metadataReady,
   independentVerificationEstablished:false,
   productionRoutingAuthorized:false};
 });
 return {total:results.length,bundleMetadataComplete:results.filter(x=>x.bundleMetadataComplete).length,
  results,independentVerificationEstablished:false,
  atlasRecordsUpdated:false,turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
module.exports={assessReviewBundle};
