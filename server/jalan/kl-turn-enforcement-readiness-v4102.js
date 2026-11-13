'use strict';
// Fail-closed classification for a FUTURE turn-aware router. Does not alter
// existing routing or claim that imported OSM restrictions are legally verified.
// Only enforce types with explicitly modelled via-node semantics. In particular,
// only_u_turn requires reversal-specific matching; treating any same-way
// continuation as its permitted exit would authorize an illegal movement.
const SUPPORTED_SIMPLE_RESTRICTIONS=new Set([
 'no_left_turn','no_right_turn','no_straight_on','no_u_turn',
 'only_left_turn','only_right_turn','only_straight_on'
]);
// A verified restriction must refer to the exact graph junction identity.
// Numeric OSM IDs must be positive and canonical; padded/sign-prefixed aliases
// or whitespace would silently miss the corresponding directed graph node.
// Symbolic fixture IDs (such as 'v') remain supported for isolated tests.
function canonicalViaNode(n){
 if(typeof n==='number')return Number.isSafeInteger(n)&&n>0;
 if(typeof n!=='string'||!n||n.trim()!==n)return false;
 // Numeric-looking aliases (decimal, exponent, hex, etc.) must not be treated
 // as symbolic fixture IDs; only the canonical positive decimal OSM ID is safe.
 if(/^[+-]?(?:\d|\.\d)/.test(n)||/^(?:NaN|[+-]?Infinity)$/i.test(n))
  return /^[1-9]\d*$/.test(n);
 return true;
}
function classifyTurnEnforcement(restrictions){
 if(!Array.isArray(restrictions))throw new TypeError('Expected restrictions array');
 const counts={total:restrictions.length,verifiedSimple:0,unverified:0,conditionalOrExcept:0,complex:0,malformed:0};
 const eligible=[];
 // Verified relation identities must be unique so one evidence item cannot
 // masquerade as multiple independently reviewed turn restrictions.
 const verifiedRelationIds=new Set();
 const independentFlags={viaWay:0,multipleViaNodes:0,missingViaNode:0,conditional:0,except:0,unverifiedApplicability:0,unknownRestriction:0};
 for(const r of restrictions){
  if(r&&typeof r==='object'){
   if(Array.isArray(r.viaWays)&&r.viaWays.length>0)independentFlags.viaWay++;
   if(Array.isArray(r.viaNodes)&&r.viaNodes.length>1)independentFlags.multipleViaNodes++;
   if(Array.isArray(r.viaNodes)&&r.viaNodes.length===0)independentFlags.missingViaNode++;
   if(!!r.conditional)independentFlags.conditional++;
   if(!!r.except)independentFlags.except++;
   if(r.applicability!=='verified')independentFlags.unverifiedApplicability++;
   if(typeof r.restriction==='string'&&!SUPPORTED_SIMPLE_RESTRICTIONS.has(r.restriction))independentFlags.unknownRestriction++;
  }
  if(!r||typeof r!=='object'||typeof r.restrictionId!=='string'||
    !r.restrictionId||r.restrictionId.trim()!==r.restrictionId||
    typeof r.fromWay!=='string'||typeof r.toWay!=='string'||
    typeof r.restriction!=='string'||!Array.isArray(r.viaNodes)||!Array.isArray(r.viaWays)||
    !/^osm-way-[1-9]\d*$/.test(r.fromWay)||!/^osm-way-[1-9]\d*$/.test(r.toWay)||
    r.viaNodes.some(n=>!canonicalViaNode(n))){
   counts.malformed++;continue;
  }
  // Verified restrictions must identify one nonempty via-node; fixtures
  // may use symbolic IDs, but imported real OSM nodes must be numeric.
  if(r.viaNodes.length!==1||r.viaWays.length!==0||
     !SUPPORTED_SIMPLE_RESTRICTIONS.has(r.restriction)){
   counts.complex++;continue;
  }
  if(r.conditional||r.except){counts.conditionalOrExcept++;continue;}
  // This explicit gate intentionally rejects imported applicability=unverified.
  if(r.applicability!=='verified'){counts.unverified++;continue;}
  if(verifiedRelationIds.has(r.restrictionId)){counts.malformed++;continue;}
  verifiedRelationIds.add(r.restrictionId);
  counts.verifiedSimple++;
  eligible.push({restrictionId:r.restrictionId,fromWay:r.fromWay,
    viaNode:String(r.viaNodes[0]),toWay:r.toWay,restriction:r.restriction});
 }
 return {counts,independentFlags,eligible,allRestrictionsReady:counts.total>0&&counts.verifiedSimple===counts.total,
  turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
}
// Share the same canonical junction-ID contract with the isolated graph search.
module.exports={classifyTurnEnforcement,canonicalViaNode};
