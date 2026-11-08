'use strict';
// V4.8.6 read-only geometry-derived trajectory comparison. No observations written.
const express = require('express');
const { Road } = require('./road-pilot');
const { matchRoads, evaluateRoad } = require('./real-road-matching');
const router = express.Router();
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const rad = d=>d*Math.PI/180;
const bearing=(a,b)=>{const p=rad(a[1]),q=rad(b[1]),dl=rad(b[0]-a[0]);return (Math.atan2(Math.sin(dl)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(dl))*180/Math.PI+360)%360;};
const length=(a,b)=>Math.hypot((b[0]-a[0])*111195*Math.cos(rad((a[1]+b[1])/2)),(b[1]-a[1])*111195);
function trajectory(road){
 const g=road.geometry;
 if(!Array.isArray(g)||g.length<2)return null;
 const segments=[];
 for(let i=1;i<g.length;i++){
  const a=g[i-1],b=g[i];
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2||![...a,...b].every(Number.isFinite))continue;
  const len=length(a,b);
  if(len>=24&&len<=2000)segments.push({a,b,len});
 }
 if(!segments.length)return null;
 segments.sort((a,b)=>b.len-a.len);
 const {a,b}=segments[0],heading=bearing(a,b);
 return [0.25,0.5,0.75].map(t=>({lat:a[1]+(b[1]-a[1])*t,lon:a[0]+(b[0]-a[0])*t,heading,accuracy:8}));
}
function matchSequence(roads,fixes){
 if(!Array.isArray(fixes)||fixes.length<3||fixes.length>8)return {status:'rejected',reason:'invalid-sequence'};
 if(fixes.some(f=>![f.lat,f.lon,f.heading,f.accuracy].every(Number.isFinite)||f.accuracy<0||f.accuracy>25||f.heading<0||f.heading>360))return {status:'rejected',reason:'invalid-fix'};
 // A road must explain every position. Avoid switching road IDs between fixes.
 const scores=[];
 for(const road of roads){
  const evaluations=fixes.map(f=>evaluateRoad(road,f.lat,f.lon,f.heading));
  if(evaluations.some((e,i)=>!e||e.distanceMeters>Math.max(12,Math.min(35,fixes[i].accuracy+10))))continue;
  const score=evaluations.reduce((sum,e)=>sum+e.distanceMeters+0.25*e.headingErrorDegrees,0)/fixes.length;
  scores.push({roadId:road.roadId,name:road.name||'',score});
 }
 scores.sort((a,b)=>a.score-b.score);
 if(!scores.length)return {status:'rejected',reason:'no-consistent-road'};
 const best=scores[0],second=scores.find(s=>s.roadId!==best.roadId);
 if(second&&second.score-best.score<12)return {status:'uncertain',reason:'multiple-consistent-roads',candidateRoadIds:[best.roadId,second.roadId]};
 return {status:'matched',roadId:best.roadId,name:best.name,score:Number(best.score.toFixed(2)),confidence:'geometry-sequence-only'};
}
async function nearby(fixes){
 const d=0.0005;
 const minLat=Math.min(...fixes.map(f=>f.lat))-d,maxLat=Math.max(...fixes.map(f=>f.lat))+d;
 const minLon=Math.min(...fixes.map(f=>f.lon))-d,maxLon=Math.max(...fixes.map(f=>f.lon))+d;
 return Road.find({'bbox.0':{$lte:maxLon},'bbox.2':{$gte:minLon},'bbox.1':{$lte:maxLat},'bbox.3':{$gte:minLat}}).select('roadId name highway oneway geometry -_id').lean().limit(300);
}
router.get('/run',async(req,res)=>{
 try{
  const n=req.query.count===undefined?12:Number(req.query.count);
  if(!Number.isInteger(n)||n<1||n>20)return res.status(400).json({ok:false,error:'count must be 1 to 20'});
  const roads=await Road.find({}).sort({roadId:1}).select('roadId name highway oneway geometry -_id').lean().limit(500);
  const tests=[];
  for(const road of roads){
   const fixes=trajectory(road);
   if(!fixes||fixes.some(f=>f.lat<3.10||f.lat>3.19||f.lon<101.65||f.lon>101.75))continue;
   const candidates=await nearby(fixes);
   const single=matchRoads(candidates,fixes[1].lat,fixes[1].lon,fixes[1].heading,fixes[1].accuracy);
   const multi=matchSequence(candidates,fixes);
   tests.push({expectedRoadId:road.roadId,expectedRoadName:road.name||'',fixCount:fixes.length,candidatesExamined:candidates.length,single:{status:single.status,roadId:single.roadId||null,correct:single.status==='matched'&&single.roadId===road.roadId},multi:{status:multi.status,reason:multi.reason||null,roadId:multi.roadId||null,correct:multi.status==='matched'&&multi.roadId===road.roadId}});
   if(tests.length>=n)break;
  }
  const tally=key=>({correct:tests.filter(t=>t[key].correct).length,uncertain:tests.filter(t=>t[key].status==='uncertain').length,rejected:tests.filter(t=>t[key].status==='rejected').length,incorrect:tests.filter(t=>t[key].status==='matched'&&!t[key].correct).length});
  res.json({ok:true,mode:'multi-point-validation-v4.8.6',readOnly:true,databaseWrites:0,generatedFromImportedGeometry:true,sampleSize:tests.length,fixesPerTest:3,single:tally('single'),multi:tally('multi'),tests,note:'In-sample same-segment geometry-derived points, not independent GPS measurements. Sequence matching may remain ambiguous for parallel roads, overlapping OSM ways and flyovers. No live traffic integration.'});
 }catch(e){console.error('Jalan V4.8.6:',e.message);res.status(503).json({ok:false,error:'Multi-point validation unavailable'});}
});
module.exports={router,trajectory,matchSequence};
