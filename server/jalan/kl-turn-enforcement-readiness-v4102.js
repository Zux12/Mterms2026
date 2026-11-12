'use strict';
// Fail-closed classification for a FUTURE turn-aware router. Does not alter
// existing routing or claim that imported OSM restrictions are legally verified.
function classifyTurnEnforcement(restrictions){
 if(!Array.isArray(restrictions))throw new TypeError('Expected restrictions array');
 const counts={total:restrictions.length,verifiedSimple:0,unverified:0,conditionalOrExcept:0,complex:0,malformed:0};
 const eligible=[];
 const independentFlags={viaWay:0,multipleViaNodes:0,missingViaNode:0,conditional:0,except:0,unverifiedApplicability:0,unknownRestriction:0};
 for(const r of restrictions){
  if(r&&typeof r==='object'){
   if(Array.isArray(r.viaWays)&&r.viaWays.length>0)independentFlags.viaWay++;
   if(Array.isArray(r.viaNodes)&&r.viaNodes.length>1)independentFlags.multipleViaNodes++;
   if(Array.isArray(r.viaNodes)&&r.viaNodes.length===0)independentFlags.missingViaNode++;
   if(!!r.conditional)independentFlags.conditional++;
   if(!!r.except)independentFlags.except++;
   if(r.applicability!=='verified')independentFlags.unverifiedApplicability++;
   if(typeof r.restriction==='string'&&!/^(no_|only_)[a-z_]+$/.test(r.restriction))independentFlags.unknownRestriction++;
  }
  if(!r||typeof r!=='object'||typeof r.fromWay!=='string'||typeof r.toWay!=='string'||
    typeof r.restriction!=='string'||!Array.isArray(r.viaNodes)||!Array.isArray(r.viaWays)||
    !/^osm-way-\\d+$/.test(r.fromWay)||!/^osm-way-\\d+$/.test(r.toWay)||
    r.viaNodes.some(n=>typeof n!=='string'&&!Number.isInteger(n))){
   counts.malformed++;continue;
  }
  if(r.viaNodes.length===1&&!/^\\d+$/.test(String(r.viaNodes[0]))){
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
 return {counts,independentFlags,eligible,allRestrictionsReady:counts.total>0&&counts.verifiedSimple===counts.total,
  turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
module.exports={classifyTurnEnforcement};
