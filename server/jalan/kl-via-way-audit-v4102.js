'use strict';
// Jalan KL pilot: read-only via-way *pattern* diagnostic, never a turn-legality verdict.
// Route runs retain directed OSM node continuity; OSM relation applicability, vehicle
// exceptions, turn times, and importer provenance have NOT been verified.
const {wayOf}=require('./kl-turn-audit-v4102');
function nodeFrom(e){return String(e?.fromNode??e?.from??'');}
function nodeTo(e){return String(e?.toNode??e?.to??'');}
function directedWayRuns(routeEdges){
 if(!Array.isArray(routeEdges))throw new TypeError('Expected traversed edge array');
 const runs=[];
 for(let i=0;i<routeEdges.length;i++){
  const e=routeEdges[i],way=wayOf(e),from=nodeFrom(e),to=nodeTo(e);
  const last=runs[runs.length-1];
  if(way&&from&&to&&last&&last.way===way&&last.to===from){
   last.to=to;last.endEdgeIndex=i;
  }else{
   // Malformed edges become barriers, not invisible connections.
   runs.push({way:way&&from&&to?way:null,from,to,startEdgeIndex:i,endEdgeIndex:i});
  }
 }
 return runs;
}
function auditViaWayPathCandidates(routeEdges,restrictions){
 if(!Array.isArray(routeEdges)||!Array.isArray(restrictions))
  throw new TypeError('Expected traversed edge and restriction arrays');
 const runs=directedWayRuns(routeEdges),byFromWay=new Map();
 let viaWayRelationsUnassessed=0;
 for(const r of restrictions){
  if(!Array.isArray(r?.viaWays)||!r.viaWays.length)continue;
  viaWayRelationsUnassessed++;
  // Mixed via-node/via-way, malformed records, and unknown restriction types
  // remain unassessed; absence of a pattern never implies legal clearance.
  if(!Array.isArray(r.viaNodes)||r.viaNodes.length!==0||
     typeof r.fromWay!=='string'||!r.fromWay||
     typeof r.toWay!=='string'||!r.toWay||
     !r.viaWays.every(w=>typeof w==='string'&&w)||
     !/^(no_|only_)/.test(String(r.restriction||'')))continue;
  if(!byFromWay.has(r.fromWay))byFromWay.set(r.fromWay,[]);
  byFromWay.get(r.fromWay).push(r);
 }
 const matches=[],onlyExitMismatches=[];
 for(let i=0;i<runs.length;i++){
  if(!runs[i].way)continue;
  for(const r of byFromWay.get(runs[i].way)||[]){
   // For an OSM via-way restriction, first prove the directed from-way/via-way
   // prefix is contiguous. An 'only_*' relation also merits an advisory if
   // that exact prefix exits onto a different way than the designated to-way.
   // This is deliberately NOT a legality/enforcement decision.
   const prefix=[r.fromWay,...r.viaWays],exitIndex=i+prefix.length;
   if(exitIndex>=runs.length)continue; // route ends before the exit: unknown
   let prefixMatches=true;
   for(let j=0;j<prefix.length;j++){
    const actual=runs[i+j];
    if(actual.way!==prefix[j]||(j>0&&runs[i+j-1].to!==actual.from)){
     prefixMatches=false;break;
    }
   }
   if(!prefixMatches)continue;
   const exit=runs[exitIndex];
   if(!exit.way||runs[exitIndex-1].to!==exit.from)continue;
   const candidate={
    restrictionId:String(r.restrictionId||''),
    startEdgeIndex:runs[i].startEdgeIndex,endEdgeIndex:exit.endEdgeIndex,
    viaWayCount:r.viaWays.length,
    conditional:!!r.conditional,except:!!r.except,
    applicability:String(r.applicability||'unknown')
   };
   if(exit.way===r.toWay){
    matches.push({...candidate,kind:'via_way_path_pattern_only'});
   }else if(r.restriction.startsWith('only_')){
    onlyExitMismatches.push({...candidate,
     kind:'via_way_only_exit_mismatch_candidate',
     expectedToWay:r.toWay,observedToWay:exit.way});
   }
  }
 }
 return {viaWayRelationsUnassessed,viaWayPathCandidateCount:matches.length,
  viaWayPathCandidates:matches,
  viaWayOnlyExitMismatchCandidateCount:onlyExitMismatches.length,
  viaWayOnlyExitMismatchCandidates:onlyExitMismatches,
  turnRestrictionsEnforced:false,legalDrivingRouteVerified:false};
}
module.exports={directedWayRuns,auditViaWayPathCandidates};
