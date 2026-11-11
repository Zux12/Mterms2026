'use strict';
// Read-only, reproducible KL pilot validation output checker.
// Usage: node server/jalan/validate-kl-pilot.js path/to/cases.json
// Does not connect to MongoDB, dispatch routes, or authorize production routing.
const fs=require('node:fs');
const requiredJourneyTypes=['short-urban','long-corridor','one-way','overpass','disconnected'];
const minCases=20,minimumPerJourneyType=4,minimumReachablePerRoutedType=2;
const routedJourneyTypes=requiredJourneyTypes.filter(t=>t!=='disconnected');
const cases=JSON.parse(fs.readFileSync(process.argv[2]||'', 'utf8'));
if(!Array.isArray(cases)||cases.length===0)throw Error('Expected a nonempty JSON array');
const failures=[],seen=new Set(),snap=[],latency=[],types=new Set();
let rejectedSnapOver200Meters=0;
const journeyTypeCounts=Object.fromEntries(requiredJourneyTypes.map(t=>[t,0]));
const reachableControlsByType=Object.fromEntries(routedJourneyTypes.map(t=>[t,0]));
let expectedNoPath=0,unexpectedNoPath=0;
const serverStageKeys=['graphLoadMs','snappingMs','pathSearchMs','serverTotalMs'];
const serverStageSamples=Object.fromEntries(serverStageKeys.map(k=>[k,[]]));
let serverTimingSamples=0;
const graphCacheTimingSamples={cold:[],warm:[]};
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
 // Keep positive controls for each routed-road class. Otherwise twenty
 // reviewed 404s could appear to cover urban, corridor and overpass routes.
 // One-way and grade-separated negative controls remain valid alongside these.
 if(routedJourneyTypes.includes(c.journeyType)&&c.expectedReachable===true)
  reachableControlsByType[c.journeyType]++;
 if(c.journeyType==='disconnected'&&c.expectedReachable===true)
  failures.push(id+': disconnected journey type must be independently expected unreachable');
 if(typeof c.ok!=='boolean')failures.push(id+': missing ok boolean');
 if(typeof c.ok==='boolean'&&typeof c.expectedReachable==='boolean'&&c.ok!==c.expectedReachable)
  failures.push(id+': actual reachability differs from independent expectedReachable');
 // Performance statistics must represent only independently verified,
 // expected journey outcomes; keep failures visible through validationErrors.
 const verifiedRoute=c.ok===true&&c.expectedReachable===true&&c.responseStatus===200&&
  c.routeModeVerified===true&&c.geometryMetricsVerified===true&&c.geometryContinuous===true&&
  Number.isFinite(c.distanceMeters)&&c.distanceMeters>=0&&
  ['startSnapMeters','endSnapMeters'].every(k=>Number.isFinite(c[k])&&c[k]>=0&&c[k]<=200);
 const verifiedNoPath=c.ok===false&&c.expectedReachable===false&&c.responseStatus===404&&
  c.noPathModeVerified===true&&c.disconnectionReviewed===true;
 const verifiedOutcome=verifiedRoute||verifiedNoPath;
 if(!Number.isFinite(c.elapsedMs)||c.elapsedMs<0)failures.push(id+': invalid elapsedMs');
 else if(verifiedOutcome)latency.push(c.elapsedMs);
 // Stage timings are optional diagnostics, not proof of safe navigation.
 // Use only complete, internally consistent measured breakdowns. Each stage
 // was rounded independently to 0.1ms by the private evidence collector.
 if(verifiedOutcome&&
   serverStageKeys.every(k=>Number.isFinite(c[k])&&c[k]>=0&&c[k]<=60000)&&
   Math.abs(c.graphLoadMs+c.snappingMs+c.pathSearchMs-c.serverTotalMs)<=0.21){
  serverTimingSamples++;
  for(const k of serverStageKeys)serverStageSamples[k].push(c[k]);
  if(c.graphCacheHit===true)graphCacheTimingSamples.warm.push(c.serverTotalMs);
  else if(c.graphCacheHit===false)graphCacheTimingSamples.cold.push(c.serverTotalMs);
 }
 // Explicit HTTP evidence prevents a 422 snap failure, 503 outage or an
 // authentication error from being mislabeled a genuinely disconnected road.
 if(!Number.isInteger(c.responseStatus)||(c.ok===true&&c.responseStatus!==200)||
    (c.ok===false&&c.responseStatus!==404))
  failures.push(id+': responseStatus must be HTTP 200 for a route or HTTP 404 for a reviewed no-path');
 if(c.ok===true){
  // A 200 status alone does not prove the experimental route contract was checked.
  if(c.routeModeVerified!==true)failures.push(id+': experimental route response not verified');
  if(!Number.isFinite(c.distanceMeters)||c.distanceMeters<0)failures.push(id+': invalid distanceMeters');
  for(const k of ['startSnapMeters','endSnapMeters']){
   if(!Number.isFinite(c[k])||c[k]<0)failures.push(id+': invalid '+k);
   else{
    if(c[k]>200){
     rejectedSnapOver200Meters++;
     failures.push(id+': successful route snap exceeds 200 m ('+k+')');
    }else if(verifiedRoute)snap.push(c[k]);
   }
  }
  // A self-declared continuous geometry is not enough for acceptance:
  // require the collector's independent endpoint and distance cross-check.
  if(c.geometryMetricsVerified!==true)failures.push(id+': independent geometry metrics not verified');
  if(c.geometryContinuous!==true)failures.push(id+': geometry continuity not verified');
 }else if(c.ok===false){
  if(c.noPathModeVerified!==true)failures.push(id+': experimental no-path response not verified');
  if(c.expectedReachable===false)expectedNoPath++;
  else unexpectedNoPath++;
  // An intentionally unreachable case must have independent evidence of
  // disconnection. A failed API response alone cannot establish this.
  if(c.expectedReachable===false&&c.disconnectionReviewed!==true)
   failures.push(id+': expected no-path case lacks disconnection review');
 }
}
snap.sort((a,b)=>a-b);latency.sort((a,b)=>a-b);
for(const k of serverStageKeys)serverStageSamples[k].sort((a,b)=>a-b);
for(const samples of Object.values(graphCacheTimingSamples))samples.sort((a,b)=>a-b);
const quantile=(arr,p)=>arr.length?arr[Math.ceil(p*arr.length)-1]:null;
const missingJourneyTypes=requiredJourneyTypes.filter(k=>!types.has(k));
const insufficientJourneyTypes=requiredJourneyTypes.filter(k=>journeyTypeCounts[k]<minimumPerJourneyType);
const insufficientReachableTypes=routedJourneyTypes.filter(k=>reachableControlsByType[k]<minimumReachablePerRoutedType);
const automatedEvidenceGatePassed=cases.length>=minCases&&
 insufficientJourneyTypes.length===0&&insufficientReachableTypes.length===0&&failures.length===0;
const summary={
 cases:cases.length,minimumCases:minCases,minimumPerJourneyType,journeyTypeCounts,insufficientJourneyTypes,
 minimumReachablePerRoutedType,reachableControlsByType,insufficientReachableTypes,
 successful:cases.filter(c=>c&&c.ok===true).length,
 failed:cases.filter(c=>c&&c.ok===false).length,
 expectedNoPath,unexpectedNoPath,
 journeyTypesCovered:[...types].sort(),missingJourneyTypes,
 snapEndpointSamples:snap.length,
 snapMedianMeters:quantile(snap,.5),snapP95Meters:quantile(snap,.95),snapMaxMeters:quantile(snap,1),
 latencySamples:latency.length,
 latencyP50Ms:quantile(latency,.5),latencyP95Ms:quantile(latency,.95),latencyMaxMs:quantile(latency,1),
 serverTimingSamples,
 graphCacheTimingByStatusMs:Object.fromEntries(Object.entries(graphCacheTimingSamples).map(([status,values])=>[status,{samples:values.length,p50:quantile(values,.5),p95:quantile(values,.95),max:quantile(values,1)}])),
 serverTimingByStageMs:Object.fromEntries(serverStageKeys.map(k=>[k,{
  p50:quantile(serverStageSamples[k],.5),
  p95:quantile(serverStageSamples[k],.95),
  max:quantile(serverStageSamples[k],1)
 }])),
 snapOver200Meters:rejectedSnapOver200Meters,
 automatedEvidenceGatePassed,manualRoadSafetyReviewRequired:true,
 productionRoutingAuthorized:false,validationErrors:failures
};
console.log(JSON.stringify(summary,null,2));
// Exit 2 = valid partial evidence, NOT a passing 20-journey acceptance gate.
// Exit 1 = malformed or contradictory evidence. Exit 0 is only structural
// evidence completeness; it does not attest legal route or navigation quality.
if(failures.length)process.exitCode=1;
else if(!automatedEvidenceGatePassed)process.exitCode=2;
