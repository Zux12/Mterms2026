'use strict';
// Offline combined gate; metadata and checklists cannot establish legal truth.
const {assessReviewBundle}=require('./kl-restriction-review-bundle-v4102');
const {assessExternalEvidence}=require('./kl-external-evidence-review-v4102');
const EXTERNAL=new Set(['road-authority','field-photo','independent-map']);
function assessEvidencePackage(reviews,manifests,externalReviews){
 const bundle=assessReviewBundle(reviews,manifests);
 const external=assessExternalEvidence(externalReviews);
 const manifestById=new Map(manifests.map(m=>[m.restrictionId,m]));
 const valid=new Map();
 for(const item of externalReviews){
  const manifest=manifestById.get(item.restrictionId);
  const artifact=manifest?.artifacts.find(a=>a.artifactId===item.artifactId);
  if(!artifact||artifact.sourceType!==item.sourceType||!EXTERNAL.has(item.sourceType))
   throw Error('External evidence review not linked to matching manifest artifact');
  const key=item.restrictionId+'|'+item.artifactId;
  valid.set(key,true);
 }
 const complete=new Set(external.results.filter(r=>r.checklistComplete)
  .map(r=>r.restrictionId+'|'+r.artifactId));
 const results=bundle.results.map(r=>{
  const manifest=manifestById.get(r.restrictionId);
  const externalArtifacts=(manifest?.artifacts||[]).filter(a=>EXTERNAL.has(a.sourceType));
  const externalChecklistComplete=externalArtifacts.some(a=>
   valid.has(r.restrictionId+'|'+a.artifactId)&&
   complete.has(r.restrictionId+'|'+a.artifactId));
  return {...r,externalChecklistComplete,
   packageMetadataComplete:r.bundleMetadataComplete&&externalChecklistComplete,
   independentVerificationEstablished:false,productionRoutingAuthorized:false};
 });
 return {total:results.length,packageMetadataComplete:results.filter(r=>r.packageMetadataComplete).length,
  results,independentVerificationEstablished:false,legalDrivingRouteVerified:false,
  turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
module.exports={assessEvidencePackage};
