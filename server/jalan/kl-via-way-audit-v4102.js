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
 const matches=[];
 for(let i=0;i<runs.length;i++){
  if(!runs[i].way)continue;
  for(const r of byFromWay.get(runs[i].way)||[]){
   const sequence=[r.fromWay,...r.viaWays,r.toWay];
   if(i+sequence.length>runs.length)continue;
   let matchesPath=true;
   for(let j=0;j<sequence.length;j++){
    const actual=runs[i+j];
    if(actual.way!==sequence[j]||(j>0&&runs[i+j-1].to!==actual.from)){
     matchesPath=false;break;
    }
   }
   if(matchesPath)matches.push({
    restrictionId:String(r.restrictionId||''),
    startEdgeIndex:runs[i].startEdgeIndex,
    endEdgeIndex:runs[i+sequence.length-1].endEdgeIndex,
    viaWayCount:r.viaWays.length,
    kind:'via_way_path_pattern_only',
    conditional:!!r.conditional,except:!!r.except,
    applicability:String(r.applicability||'unknown')
   });
  }
 }
 return {viaWayRelationsUnassessed,viaWayPathCandidateCount:matches.length,
  viaWayPathCandidates:matches,turnRestrictionsEnforced:false,
  legalDrivingRouteVerified:false};
}
module.exports={directedWayRuns,auditViaWayPathCandidates};
