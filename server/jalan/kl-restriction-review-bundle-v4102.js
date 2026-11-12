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
  byId.set(checked.restrictionId,checked);
 }
 for(const id of byId.keys()){
  if(!reviews.results.some(x=>x.restrictionId===id))
   throw Error('Orphan evidence manifest');
 }
 const results=reviews.results.map(r=>{
  const manifest=byId.get(r.restrictionId);
  const metadataReady=r.reviewAccepted&&!!manifest&&manifest.sourceDiversity;
  return {restrictionId:r.restrictionId,reviewMetadataComplete:r.reviewAccepted,
   evidenceMetadataComplete:!!manifest?.metadataComplete,
   evidenceSourceDiversity:!!manifest?.sourceDiversity,
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
