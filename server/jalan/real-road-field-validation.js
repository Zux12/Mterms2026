'use strict';
// V4.8.5: deterministic, read-only real-geometry validation. No GPS or traffic writes.
const express = require('express');
const { Road } = require('./road-pilot');
const { matchRoads } = require('./real-road-matching');
const router = express.Router();
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
const rad = n => n*Math.PI/180;
function bearing(a,b){const p1=rad(a[1]),p2=rad(b[1]),dl=rad(b[0]-a[0]);return (Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360;}
function lengthMeters(a,b){const x=(b[0]-a[0])*111195*Math.cos(rad((a[1]+b[1])/2)),y=(b[1]-a[1])*111195;return Math.hypot(x,y);}
function samplePoint(road){
 const g=road.geometry;
 if(!Array.isArray(g)||g.length<2)return null;
 const segments=[];
 for(let i=1;i<g.length;i++){
  const a=g[i-1],b=g[i];
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||![...a,...b].every(Number.isFinite))continue;
  const len=lengthMeters(a,b);
  if(len>=12&&len<=2000)segments.push({a,b,len});
 }
 if(!segments.length)return null;
 // Longest nondegenerate segment midpoint, deterministic across deployments.
 segments.sort((a,b)=>b.len-a.len);
 const {a,b}=segments[0];
 return {lat:(a[1]+b[1])/2,lon:(a[0]+b[0])/2,heading:bearing(a,b)};
}
async function nearby(lat,lon){
 const d=0.0005;
 return Road.find({'bbox.0':{$lte:lon+d},'bbox.2':{$gte:lon-d},'bbox.1':{$lte:lat+d},'bbox.3':{$gte:lat-d}})
  .select('roadId name highway oneway geometry -_id').lean().limit(300);
}
router.get('/run',async(req,res)=>{
 try{
  const n=req.query.count===undefined?12:Number(req.query.count);
  if(!Number.isInteger(n)||n<1||n>20)return res.status(400).json({error:'count must be an integer between 1 and 20'});
  // Stable sample across distinct OSM IDs; avoid heavy collection scans / random sampling.
  const roads=await Road.find({}).sort({roadId:1}).select('roadId name highway oneway geometry -_id').lean().limit(300);
  const chosen=[];
  for(const road of roads){const point=samplePoint(road);if(point&&point.lat>=3.10&&point.lat<=3.19&&point.lon>=101.65&&point.lon<=101.75){chosen.push({road,point});if(chosen.length>=n)break;}}
  const tests=[];
  for(const {road,point} of chosen){
   const candidates=await nearby(point.lat,point.lon);
   const result=matchRoads(candidates,point.lat,point.lon,point.heading,8);
   const correct=result.status==='matched'&&result.roadId===road.roadId;
   const testsResult={expectedRoadId:road.roadId,expectedRoadName:road.name||'',testFix:{lat:Number(point.lat.toFixed(6)),lon:Number(point.lon.toFixed(6)),heading:Number(point.heading.toFixed(1)),accuracy:8},candidatesExamined:candidates.length,status:result.status,reason:result.reason||null,matchedRoadId:result.roadId||null,correct};
   tests.push(testsResult);
  }
  const matched=tests.filter(x=>x.status==='matched').length;
  const correct=tests.filter(x=>x.correct).length;
  const uncertain=tests.filter(x=>x.status==='uncertain').length;
  const rejected=tests.filter(x=>x.status==='rejected').length;
  res.json({ok:true,mode:'real-road-field-validation-v4.8.5',readOnly:true,syntheticOnly:false,generatedFromImportedGeometry:true,databaseWrites:0,sampleSize:tests.length,summary:{matched,correct,uncertain,rejected,correctRate:tests.length?Number((100*correct/tests.length).toFixed(1)):0},tests,note:'In-sample geometry midpoint checks, NOT independent GPS ground truth. Adjacent ways and flyovers may be ambiguous. No traffic inference.'});
 }catch(e){console.error('Jalan v4.8.5 validation:',e.message);res.status(503).json({ok:false,error:'Road validation unavailable'});}
});
module.exports={router,samplePoint};
