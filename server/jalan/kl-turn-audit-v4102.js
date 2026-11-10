'use strict';
// Pure, read-only candidate matcher for the KL OSM turn-restriction import.
// NOT a legality engine: input restrictions have unverified applicability;
// via-way/complex relations, modal exceptions and conditional times are not enforced.
function wayOf(e){
 if(e&&typeof e.roadId==='string'&&e.roadId)return e.roadId;
 const m=/^(osm-way-\d+):\d+:[FR]$/.exec(String(e?.id||''));
 return m?m[1]:null;
}
function nodeFrom(e){return String(e?.fromNode??e?.from??'');}
function nodeTo(e){return String(e?.toNode??e?.to??'');}
function auditTurnCandidates(routeEdges,restrictions){
 if(!Array.isArray(routeEdges)||!Array.isArray(restrictions))
  throw new TypeError('Expected arrays of traversed edges and restrictions');
 const index=new Map();
 let complexRestrictionsUnassessed=0;
 for(const r of restrictions){
  if(!r||typeof r.fromWay!=='string'||typeof r.toWay!=='string'||
   !Array.isArray(r.viaNodes)||r.viaNodes.length!==1||
   !Array.isArray(r.viaWays)||r.viaWays.length!==0||
   !/^(no_|only_)/.test(String(r.restriction||''))){
   complexRestrictionsUnassessed++;continue;
  }
  const key=JSON.stringify([r.fromWay,String(r.viaNodes[0])]);
  if(!index.has(key))index.set(key,[]);
  index.get(key).push(r);
 }
 let transitionsInspected=0;
 const potentialTurnRestrictions=[];
 for(let i=1;i<routeEdges.length;i++){
  const incoming=routeEdges[i-1],outgoing=routeEdges[i],via=nodeTo(incoming);
  if(!via||via!==nodeFrom(outgoing))continue;
  const fromWay=wayOf(incoming),toWay=wayOf(outgoing);
  if(!fromWay||!toWay)continue;
  transitionsInspected++;
  const candidates=index.get(JSON.stringify([fromWay,via]))||[];
  for(const r of candidates){
   const isNo=r.restriction.startsWith('no_');
   let suspect=isNo?toWay===r.toWay:toWay!==r.toWay;
   // Continuing straight on the same OSM way is not a U-turn.
   if(isNo&&r.restriction==='no_u_turn'&&fromWay===toWay&&
      nodeFrom(incoming)!==nodeTo(outgoing))suspect=false;
   if(suspect)potentialTurnRestrictions.push({
    restrictionId:String(r.restrictionId||''),
    transitionIndex:i-1,
    kind:isNo?'no_turn_candidate':'only_turn_mismatch_candidate',
    conditional:!!r.conditional,
    except:!!r.except,
    applicability:String(r.applicability||'unknown')
   });
  }
 }
 return {transitionsInspected,potentialTurnRestrictionReviewCount:potentialTurnRestrictions.length,
  potentialTurnRestrictions,complexRestrictionsUnassessed,
  turnRestrictionsEnforced:false,legalDrivingRouteVerified:false};
}
module.exports={auditTurnCandidates,wayOf};
