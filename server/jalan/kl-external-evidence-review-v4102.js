'use strict';
// Offline external-evidence checklist; self-declared evidence never establishes
// actual authenticity or legal driving access. No database or route changes.
const TYPES=new Set(['road-authority','field-photo','independent-map']);
function assessExternalEvidence(items){
 if(!Array.isArray(items))throw new TypeError('Expected evidence review array');
 const seen=new Set(),results=[];
 for(const x of items){
  if(!x||typeof x!=='object'||Array.isArray(x)||
    !/^osm-relation-\d+$/.test(x.restrictionId||'')||
    typeof x.artifactId!=='string'||!/^[a-zA-Z0-9_-]{5,80}$/.test(x.artifactId)||
    seen.has(x.restrictionId+'|'+x.artifactId)||
    !TYPES.has(x.sourceType))throw Error('Invalid or duplicate external evidence');
  seen.add(x.restrictionId+'|'+x.artifactId);
  const complete=typeof x.reviewerId==='string'&&x.reviewerId.trim().length>=3&&
   typeof x.reviewedAt==='string'&&!Number.isNaN(Date.parse(x.reviewedAt))&&
   typeof x.sourceReference==='string'&&x.sourceReference.length>=5&&
   x.sourceIdentityChecked===true&&x.locationMatchChecked===true&&
   x.directionMatchChecked===true&&x.currentValidityChecked===true&&
   x.restrictionSemanticsChecked===true;
  results.push({restrictionId:x.restrictionId,artifactId:x.artifactId,
   checklistComplete:complete,authenticityIndependentlyEstablished:false,
   legalDrivingRouteVerified:false});
 }
 return {total:results.length,checklistsComplete:results.filter(x=>x.checklistComplete).length,
  results,authenticityIndependentlyEstablished:false,turnRestrictionsEnforced:false,
  productionRoutingAuthorized:false};
}
module.exports={assessExternalEvidence};
