'use strict';
// Read-only road matching preview. Does not modify live traffic observations.
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const db = mongoose.connection.useDb('jalan_navigation', { useCache: true });
const roadSchema = new mongoose.Schema({
  roadId: {type:String,required:true,unique:true}, name:String, highway:String,
  oneway:Boolean, maxspeed:String, geometry:{type:[[Number]],required:true},
  bbox:{type:[Number],required:true}, importedAt:{type:Date,default:Date.now}
},{collection:'pilot_roads',versionKey:false});
roadSchema.index({bbox:1});
const Road = db.models.JalanPilotRoad || db.model('JalanPilotRoad',roadSchema);
const rad=n=>n*Math.PI/180;
function distanceMeters(lat,lon,a,b){
 const x=(b[0]-a[0])*111320*Math.cos(rad(lat));
 const y=(b[1]-a[1])*111320;
 const px=(lon-a[0])*111320*Math.cos(rad(lat));
 const py=(lat-a[1])*111320;
 const t=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1)));
 return {distance:Math.hypot(px-t*x,py-t*y),heading:(Math.atan2(x,y)*180/Math.PI+360)%360};
}
function angle(a,b){return Math.abs(((a-b+540)%360)-180);}
function match(lat,lon,heading,accuracy,roads){
 if(![lat,lon,heading,accuracy].every(Number.isFinite)||accuracy>25||accuracy<0||lat<-90||lat>90||lon<-180||lon>180)return {status:'rejected',reason:'invalid-or-inaccurate-gps'};
 const candidates=[];
 for(const road of roads){
  let best=null;
  for(let i=1;i<road.geometry.length;i++){
   const p=distanceMeters(lat,lon,road.geometry[i-1],road.geometry[i]);
   const err=road.oneway?angle(heading,p.heading):Math.min(angle(heading,p.heading),angle(heading,(p.heading+180)%360));
   if(err>40)continue;
   const score=p.distance+err*.4;
   if(!best||score<best.score)best={distanceMeters:p.distance,headingErrorDegrees:err,score};
  }
  if(best&&best.distanceMeters<=Math.max(15,accuracy+12))candidates.push({roadId:road.roadId,name:road.name,highway:road.highway,...best});
 }
 candidates.sort((a,b)=>a.score-b.score);
 if(!candidates.length)return {status:'rejected',reason:'no-compatible-road'};
 if(candidates.length>1&&candidates[1].score-candidates[0].score<Math.max(10,accuracy*.8))return {status:'uncertain',reason:'ambiguous-roads',candidates:candidates.slice(0,3).map(x=>x.roadId)};
 const best=candidates[0];return {status:'matched',roadId:best.roadId,name:best.name,highway:best.highway,distanceMeters:Math.round(best.distanceMeters),headingErrorDegrees:Math.round(best.headingErrorDegrees)};
}
router.get('/health',async(_req,res)=>{try{const count=await Road.countDocuments();res.json({ok:true,mode:'road-pilot-v4.8.3',roadCount:count,liveTrafficUnchanged:true});}catch(e){res.status(503).json({ok:false,error:'Road database unavailable'});}});
router.get('/match',async(req,res)=>{
 const lat=Number(req.query.lat),lon=Number(req.query.lon),heading=Number(req.query.heading),accuracy=Number(req.query.accuracy);
 if(![lat,lon,heading,accuracy].every(Number.isFinite)||lat<2.8||lat>3.5||lon<101.3||lon>102||heading<0||heading>360||accuracy<0||accuracy>100)return res.status(400).json({error:'Invalid pilot query'});
 try{
  const d=.0015;
  const roads=await Road.find({'bbox.0':{$lte:lon+d},'bbox.2':{$gte:lon-d},'bbox.1':{$lte:lat+d},'bbox.3':{$gte:lat-d}}).limit(300).lean();
  const result=match(lat,lon,heading,accuracy,roads);
  res.json({mode:'road-pilot-v4.8.3',...result,roadCandidatesLoaded:roads.length,notForLiveCongestion:true});
 }catch(e){console.error('Jalan pilot match:',e.message);res.status(503).json({error:'Road matching unavailable'});}
});
module.exports={router,match,Road};
