'use strict';
// Offline review-evidence gate. A review record never edits Atlas, never
// changes imported applicability and never authorizes production routing.
const VALID=new Set(['pending','verified','rejected']);
function assessRestrictionReview(records){
 if(!Array.isArray(records))throw new TypeError('Expected review records');
 const seen=new Set(),results=[];
 for(const r of records){
  if(!r||typeof r!=='object'||Array.isArray(r)||
   !/^osm-relation-\d+$/.test(r.restrictionId||'')||
   seen.has(r.restrictionId))throw Error('Invalid or duplicate relation ID');
  seen.add(r.restrictionId);
  if(!VALID.has(r.status))throw Error('Invalid review status');
  const evidence=Array.isArray(r.evidenceRefs)&&r.evidenceRefs.length>=2&&
   r.evidenceRefs.every(x=>typeof x==='string'&&/^[a-zA-Z0-9:_./-]{5,160}$/.test(x))&&
   new Set(r.evidenceRefs).size===r.evidenceRefs.length;
  const independent=typeof r.reviewerId==='string'&&r.reviewerId.trim().length>=3&&
   typeof r.reviewedAt==='string'&&!Number.isNaN(Date.parse(r.reviewedAt))&&
   typeof r.sourceVersion==='string'&&r.sourceVersion.length>=8;
  const semantics=typeof r.restrictionType==='string'&&/^(no_|only_)[a-z_]+$/.test(r.restrictionType)&&
   r.timezone==='Asia/Kuala_Lumpur'&&r.roadAccessChecked===true&&
   r.turnGeometryChecked===true&&r.conditionalRulesChecked===true;
  const accepted=r.status==='verified'&&evidence&&independent&&semantics;
  results.push({restrictionId:r.restrictionId,reviewAccepted:!!accepted,
   reason:accepted?'review-evidence-complete':'manual-review-incomplete'});
 }
 return {total:results.length,accepted:results.filter(x=>x.reviewAccepted).length,
  pending:results.filter(x=>!x.reviewAccepted).length,results,
  atlasRecordsUpdated:false,turnRestrictionsEnforced:false,
  productionRoutingAuthorized:false};
}
module.exports={assessRestrictionReview};
