'use strict';
// V4.8.7 read-only comparison against exactly the same deterministic sample as V4.8.6.
// No writes, no live GPS, no traffic inference. Uses existing v4.8.6 trajectory.
const express = require('express');
const { Road } = require('./road-pilot');
const { matchRoads, evaluateRoad } = require('./real-road-matching');
const { trajectory, matchSequence } = require('./multi-point-validation');
const router = express.Router();
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const rad=x=>x*Math.PI/180;
function meters(a,b){return Math.hypot((a.lon-b.lon)*111195*Math.cos(rad((a.lat+b.lat)/2)),(a.lat-b.lat)*111195);}
function weightedMatch(roads,fixes){
 if(!Array.isArray(fixes)||fixes.length<3||fixes.length>8||fixes.some(f=>![f.lat,f.lon,f.heading,f.accuracy].every(Number.isFinite)||f.lat<-90||f.lat>90||f.lon<-180||f.lon>180||f.heading<0||f.heading>360||f.accuracy<0||f.accuracy>25))return {status:'rejected',reason:'invalid-sequence'};
 // Road geometry can be divided into adjacent OSM ways; this release does not infer connectivity.
 // Require plausible geometry at ALL fixes, with a robust average instead of winner-take-all.
 const scored=[];
 for(const road of roads){
  const ev=fixes.map(f=>evaluateRoad(road,f.lat,f.lon,f.heading));
  if(ev.some((e,i)=>!e||e.distanceMeters>Math.max(12,Math.min(35,fixes[i].accuracy+10))))continue;
  const costs=ev.map(e=>e.distanceMeters+0.25*e.headingErrorDegrees);
  const mean=costs.reduce((a,b)=>a+b,0)/costs.length;
  const spread=Math.max(...costs)-Math.min(...costs);
  const score=mean+0.1*spread;
  scored.push({roadId:road.roadId,name:road.name||'',score});
 }
 scored.sort((a,b)=>a.score-b.score||a.roadId.localeCompare(b.roadId));
 if(!scored.length)return {status:'rejected',reason:'no-consistent-road'};
 const best=scored[0],runner=scored[1];
 // Stricter ambiguity check remains deliberate. Do not turn ambiguity into a forced match.
 if(runner&&runner.score-best.score<8)return {status:'uncertain',reason:'multiple-consistent-roads',candidateRoadIds:[best.roadId,runner.roadId]};
 return {status:'matched',roadId:best.roadId,score:+best.score.toFixed(2),confidence:'geometry-derived-only'};
}
async function nearby(fixes){
 const d=0.0005;
 const lat=fixes.map(f=>f.lat),lon=fixes.map(f=>f.lon);
 return Road.find({'bbox.0':{$lte:Math.max(...lon)+d},'bbox.2':{$gte:Math.min(...lon)-d},'bbox.1':{$lte:Math.max(...lat)+d},'bbox.3':{$gte:Math.min(...lat)-d}}).select('roadId name highway oneway geometry -_id').lean().limit(300);
}
function result(r,expected){return {status:r.status,reason:r.reason||null,roadId:r.roadId||null,correct:r.status==='matched'&&r.roadId===expected};}
function tally(tests,key){return {correct:tests.filter(t=>t[key].correct).length,uncertain:tests.filter(t=>t[key].status==='uncertain').length,rejected:tests.filter(t=>t[key].status==='rejected').length,incorrect:tests.filter(t=>t[key].status==='matched'&&!t[key].correct).length};}
router.get('/run',async(req,res)=>{
 try{
  const n=req.query.count===undefined?12:Number(req.query.count);
  if(!Number.isInteger(n)||n<1||n>20)return res.status(400).json({ok:false,error:'count must be an integer from 1 to 20'});
  const roads=await Road.find({}).sort({roadId:1}).select('roadId name highway oneway geometry -_id').lean().limit(500);
  const tests=[];
  for(const road of roads){
   const fixes=trajectory(road);
   if(!fixes||fixes.some(f=>f.lat<3.10||f.lat>3.19||f.lon<101.65||f.lon>101.75))continue;
   const candidates=await nearby(fixes);
   const single=matchRoads(candidates,fixes[1].lat,fixes[1].lon,fixes[1].heading,fixes[1].accuracy);
   const oldMulti=matchSequence(candidates,fixes);
   const weighted=weightedMatch(candidates,fixes);
   // Conservative hybrid: never replace a matched single fix with an ambiguous multi-point guess.
   // If both agree, confirm. If they conflict, abstain. If single is uncertain, accept only
   // a weighted match that also agrees with at least two independently evaluated fixes.
   let hybrid;
   if(single.status==='matched'&&weighted.status==='matched'&&single.roadId===weighted.roadId)hybrid={status:'matched',roadId:single.roadId};
   else if(single.status==='matched'&&weighted.status==='uncertain'&&weighted.candidateRoadIds?.includes(single.roadId))hybrid={status:'matched',roadId:single.roadId,reason:'single-match-retained-with-sequence-ambiguity'};
   else if(single.status==='matched')hybrid={status:'uncertain',reason:'single-sequence-disagreement'};
   else if(weighted.status==='matched'){
    const supporting=fixes.filter(f=>matchRoads(candidates,f.lat,f.lon,f.heading,f.accuracy).roadId===weighted.roadId).length;
    hybrid=supporting>=2?{status:'matched',roadId:weighted.roadId}:{status:'uncertain',reason:'insufficient-independent-fix-support'};
   }else hybrid={status:single.status==='rejected'?'rejected':'uncertain',reason:'no-confident-consensus'};
   tests.push({expectedRoadId:road.roadId,expectedRoadName:road.name||'',fixCount:fixes.length,candidatesExamined:candidates.length,single:result(single,road.roadId),v486:result(oldMulti,road.roadId),weighted:result(weighted,road.roadId),hybrid:result(hybrid,road.roadId)});
   if(tests.length>=n)break;
  }
  const summary={single:tally(tests,'single'),v486:tally(tests,'v486'),weighted:tally(tests,'weighted'),hybrid:tally(tests,'hybrid')};
  res.json({ok:true,mode:'weighted-sequence-validation-v4.8.7',readOnly:true,databaseWrites:0,generatedFromImportedGeometry:true,sampleSize:tests.length,fixesPerTest:3,summary,tests,note:'Same deterministic geometry-derived sample as v4.8.6; NOT independent GPS accuracy. Hybrid retains some single-fix matches by design, not proof of improved sequence matching. No connected-way graph, flyover-level verification, or nationwide data in this release.'});
 }catch(e){console.error('Jalan V4.8.7 validation:',e.message);res.status(503).json({ok:false,error:'Weighted validation unavailable'});}
});
module.exports={router,weightedMatch};
