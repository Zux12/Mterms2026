'use strict';
// Geometry-only KL preview diagnostic: matching OSM node IDs do not guarantee
// that imported coordinates touch. This advisory NEVER validates route legality.
function valid(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);}
function auditPathGeometryGaps(path,distance,thresholdMeters=2){
 if(!Array.isArray(path)||typeof distance!=='function'||
    !Number.isFinite(thresholdMeters)||thresholdMeters<0)
  throw new TypeError('Expected traversed path, distance function and nonnegative threshold');
 let max=0,overThreshold=0,inspected=0;
 for(let i=1;i<path.length;i++){
  const prev=path[i-1]?.coords,next=path[i]?.coords;
  const end=Array.isArray(prev)?prev[prev.length-1]:null;
  const start=Array.isArray(next)?next[0]:null;
  if(!valid(end)||!valid(start))return {
   geometryGapReviewAvailable:false,geometryGapTransitionsInspected:inspected,
   geometryGapThresholdMeters:thresholdMeters,
   geometryGapCountOverThreshold:null,geometryMaxGapMeters:null,
   geometryGapAdvisoryOnly:true};
  const gap=distance(end,start);
  if(!Number.isFinite(gap)||gap<0)return {
   geometryGapReviewAvailable:false,geometryGapTransitionsInspected:inspected,
   geometryGapThresholdMeters:thresholdMeters,
   geometryGapCountOverThreshold:null,geometryMaxGapMeters:null,
   geometryGapAdvisoryOnly:true};
  inspected++;
  if(gap>thresholdMeters)overThreshold++;
  max=Math.max(max,gap);
 }
 return {geometryGapReviewAvailable:true,geometryGapTransitionsInspected:inspected,
  geometryGapThresholdMeters:thresholdMeters,
  geometryGapCountOverThreshold:overThreshold,
  geometryMaxGapMeters:Math.round(max*10)/10,
  geometryGapAdvisoryOnly:true};
}
module.exports={auditPathGeometryGaps};
