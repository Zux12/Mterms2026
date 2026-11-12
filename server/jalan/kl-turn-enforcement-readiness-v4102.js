'use strict';
// Fail-closed classification for a FUTURE turn-aware router. Does not alter
// existing routing or claim that imported OSM restrictions are legally verified.
function classifyTurnEnforcement(restrictions){
 if(!Array.isArray(restrictions))throw new TypeError('Expected restrictions array');
 const counts={total:restrictions.length,verifiedSimple:0,unverified:0,conditionalOrExcept:0,complex:0,malformed:0};
 const eligible=[];
 for(const r of restrictions){
  if(!r||typeof r!=='object'||typeof r.fromWay!=='string'||typeof r.toWay!=='string'||
    typeof r.restriction!=='string'||!Array.isArray(r.viaNodes)||!Array.isArray(r.viaWays)){
   counts.malformed++;continue;
  }
  if(r.viaNodes.length!==1||r.viaWays.length!==0||
     !/^(no_|only_)[a-z_]+$/.test(r.restriction)){
   counts.complex++;continue;
  }
  if(r.conditional||r.except){counts.conditionalOrExcept++;continue;}
  // This explicit gate intentionally rejects imported applicability=unverified.
  if(r.applicability!=='verified'){counts.unverified++;continue;}
  counts.verifiedSimple++;
  eligible.push({restrictionId:String(r.restrictionId||''),fromWay:r.fromWay,
    viaNode:String(r.viaNodes[0]),toWay:r.toWay,restriction:r.restriction});
 }
 return {counts,eligible,allRestrictionsReady:counts.total>0&&counts.verifiedSimple===counts.total,
  turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
module.exports={classifyTurnEnforcement};
