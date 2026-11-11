'use strict';
// KL pilot route-plausibility heuristic, using SNAPPED road endpoints.
// A circuitous journey is NOT automatically wrong: one-way roads, bridges,
// closures and legal restrictions may create a legitimate long detour.
// No map matching, turn decision, ETA or production routing is altered.
function validPoint(p){
 return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&
  Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
}
function auditRoutePlausibility(routeMeters,startPoint,endPoint,distance,
 reviewRatio=4,minDirectMeters=100){
 if(!Number.isFinite(reviewRatio)||reviewRatio<=1||
    !Number.isFinite(minDirectMeters)||minDirectMeters<=0)
  throw new TypeError('Expected ratio >1 and positive minimum direct distance');
 const unknown=(direct=null)=>({
  routePlausibilityReviewAvailable:false,
  routeDirectDistanceMeters:direct,routeDetourRatio:null,
  routeDetourReviewCandidate:null,routeTooShortReviewCandidate:null,
  routeDetourRatioThreshold:reviewRatio,
  routeDetourMinimumDirectMeters:minDirectMeters,
  routePlausibilityAdvisoryOnly:true
 });
 if(!validPoint(startPoint)||!validPoint(endPoint)||
    !Number.isFinite(routeMeters)||routeMeters<0||typeof distance!=='function')
  return unknown();
 const direct=distance(startPoint,endPoint);
 if(!Number.isFinite(direct)||direct<0)return unknown();
 const rounded=Math.round(direct*10)/10;
 // Near-zero denominators make ratios unstable. Expose unknown, not "safe".
 if(direct<minDirectMeters)return unknown(rounded);
 const ratio=routeMeters/direct;
 return {
  routePlausibilityReviewAvailable:true,
  routeDirectDistanceMeters:rounded,
  routeDetourRatio:Math.round(ratio*100)/100,
  routeDetourReviewCandidate:ratio>=reviewRatio,
  // A route substantially shorter than the geodesic signals bad edge costs
  // or topology. Allow 1% and 2m numerical tolerance before warning.
  routeTooShortReviewCandidate:routeMeters+Math.max(2,direct*.01)<direct,
  routeDetourRatioThreshold:reviewRatio,
  routeDetourMinimumDirectMeters:minDirectMeters,
  routePlausibilityAdvisoryOnly:true
 };
}
module.exports={auditRoutePlausibility};
