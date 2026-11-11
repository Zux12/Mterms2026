'use strict';
// Read-only, reproducible KL pilot validation output checker.
// Usage: node server/jalan/validate-kl-pilot.js path/to/cases.json
// Does not connect to MongoDB, dispatch routes, or authorize production routing.
const fs=require('node:fs');
const requiredJourneyTypes=['short-urban','long-corridor','one-way','overpass','disconnected'];
const minCases=20,minimumPerJourneyType=4;
const cases=JSON.parse(fs.readFileSync(process.argv[2]||'', 'utf8'));
if(!Array.isArray(cases)||cases.length===0)throw Error('Expected a nonempty JSON array');
const failures=[],seen=new Set(),snap=[],latency=[],types=new Set();
const journeyTypeCounts=Object.fromEntries(requiredJourneyTypes.map(t=>[t,0]));
let expectedNoPath=0,unexpectedNoPath=0;
for(const [i,c] of cases.entries()){
 if(!c||typeof c!=='object'||Array.isArray(c)){
  failures.push('case '+i+': expected object');continue;
 }
 const id=String(c.caseId||'');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||seen.has(id))failures.push('case '+i+': invalid or duplicate ID');
 seen.add(id);
 if(!requiredJourneyTypes.includes(c.journeyType))failures.push(id+': missing/invalid journeyType');
 else {types.add(c.journeyType);journeyTypeCounts[c.journeyType]++;}
 if(typeof c.expectedReachable!=='boolean')failures.push(id+': missing expectedReachable boolean');
 if(typeof c.ok!=='boolean')failures.push(id+': missing ok boolean');
 if(typeof c.ok==='boolean'&&typeof c.expectedReachable==='boolean'&&c.ok!==c.expectedReachable)
  failures.push(id+': actual reachability differs from independent expectedReachable');
 if(!Number.isFinite(c.elapsedMs)||c.elapsedMs<0)failures.push(id+': invalid elapsedMs');
 else latency.push(c.elapsedMs);
 // Explicit HTTP evidence prevents a 422 snap failure, 503 outage or an
 // authentication error from being mislabeled a genuinely disconnected road.
 if(!Number.isInteger(c.responseStatus)||(c.ok===true&&c.responseStatus!==200)||
    (c.ok===false&&c.responseStatus!==404))
  failures.push(id+': responseStatus must be HTTP 200 for a route or HTTP 404 for a reviewed no-path');
 if(c.ok===true){
  if(!Number.isFinite(c.distanceMeters)||c.distanceMeters<0)failures.push(id+': invalid distanceMeters');
  for(const k of ['startSnapMeters','endSnapMeters']){
   if(!Number.isFinite(c[k])||c[k]<0)failures.push(id+': invalid '+k);
   else{
    snap.push(c[k]);
    if(c[k]>200)failures.push(id+': successful route snap exceeds 200 m ('+k+')');
   }
  }
  if(c.geometryContinuous!==true)failures.push(id+': geometry continuity not verified');
 }else if(c.ok===false){
  if(c.expectedReachable===false)expectedNoPath++;
  else unexpectedNoPath++;
  // An intentionally unreachable case must have independent evidence of
  // disconnection. A failed API response alone cannot establish this.
  if(c.expectedReachable===false&&c.disconnectionReviewed!==true)
   failures.push(id+': expected no-path case lacks disconnection review');
 }
}
snap.sort((a,b)=>a-b);latency.sort((a,b)=>a-b);
const quantile=(arr,p)=>arr.length?arr[Math.ceil(p*arr.length)-1]:null;
const missingJourneyTypes=requiredJourneyTypes.filter(k=>!types.has(k));
const insufficientJourneyTypes=requiredJourneyTypes.filter(k=>journeyTypeCounts[k]<minimumPerJourneyType);
const automatedEvidenceGatePassed=cases.length>=minCases&&
 insufficientJourneyTypes.length===0&&failures.length===0;
const summary={
 cases:cases.length,minimumCases:minCases,minimumPerJourneyType,journeyTypeCounts,insufficientJourneyTypes,
 successful:cases.filter(c=>c&&c.ok===true).length,
 failed:cases.filter(c=>c&&c.ok===false).length,
 expectedNoPath,unexpectedNoPath,
 journeyTypesCovered:[...types].sort(),missingJourneyTypes,
 snapMedianMeters:quantile(snap,.5),snapP95Meters:quantile(snap,.95),snapMaxMeters:quantile(snap,1),
 latencyP50Ms:quantile(latency,.5),latencyP95Ms:quantile(latency,.95),latencyMaxMs:quantile(latency,1),
 snapOver200Meters:snap.filter(x=>x>200).length,
 automatedEvidenceGatePassed,manualRoadSafetyReviewRequired:true,
 productionRoutingAuthorized:false,validationErrors:failures
};
console.log(JSON.stringify(summary,null,2));
// Exit 2 = valid partial evidence, NOT a passing 20-journey acceptance gate.
// Exit 1 = malformed or contradictory evidence. Exit 0 is only structural
// evidence completeness; it does not attest legal route or navigation quality.
if(failures.length)process.exitCode=1;
else if(!automatedEvidenceGatePassed)process.exitCode=2;
