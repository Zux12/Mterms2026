'use strict';
const express=require('express');
const mongoose=require('mongoose');
const crypto=require('crypto');
const router=express.Router();
const db=mongoose.connection.useDb('jalan_navigation',{useCache:true});
const schema=new mongoose.Schema({cell:String,direction:Number,speed:Number,at:{type:Date,default:Date.now},source:String,sessionHash:String},{versionKey:false,collection:'traffic_observations'});
schema.index({at:1},{expireAfterSeconds:900});
schema.index({cell:1,direction:1,at:-1});
const Observation=db.model('TrafficObservation',schema);
const ipBuckets=new Map();
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/health',(_req,res)=>res.json({ok:true,service:'jalan',database:db.name,mode:'pilot'}));
function cell(lat,lon){return `${Math.floor(lat*500)}:${Math.floor(lon*500)}`;} // ~200m latitude grid; NOT map-matched
function dir(heading){return Math.floor((((heading%360)+360)%360)/45);}
function validCoord(x,lo,hi){return typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;}
router.post('/observations',express.json({limit:'2kb'}),async(req,res)=>{
 try{
  const now=Date.now(),ip=req.ip||'unknown',bucket=ipBuckets.get(ip)||{n:0,until:now+60000};if(now>bucket.until){bucket.n=0;bucket.until=now+60000;}if(++bucket.n>20){ipBuckets.set(ip,bucket);return res.status(429).json({error:'Too many requests'});}ipBuckets.set(ip,bucket);
  const {lat,lon,speedKmh,heading,accuracy,sessionId}=req.body||{};
  if(!validCoord(lat,-90,90)||!validCoord(lon,-180,180)||!validCoord(speedKmh,0,180)||!validCoord(heading,0,360)||!validCoord(accuracy,0,25)||typeof sessionId!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(sessionId))return res.status(400).json({error:'Invalid observation'});
  // The session token is never stored verbatim. Server-side secret is required.
  if(!process.env.JALAN_HASH_SECRET||process.env.JALAN_HASH_SECRET.length<32)return res.status(503).json({error:'Jalan server configuration incomplete'});
  const sessionHash=crypto.createHmac('sha256',process.env.JALAN_HASH_SECRET).update(sessionId).digest('hex');
  await Observation.create({cell:cell(lat,lon),direction:dir(heading),speed:Math.round(speedKmh),source:'opt-in',sessionHash});
  return res.status(202).json({accepted:true,retentionMinutes:15});
 }catch(e){console.error('Jalan submit failed:',e.message);return res.status(503).json({error:'Traffic service unavailable'});}
});
router.get('/traffic',async(req,res)=>{
 try{
  const lat=Number(req.query.lat),lon=Number(req.query.lon);if(!validCoord(lat,-90,90)||!validCoord(lon,-180,180))return res.status(400).json({error:'Invalid location'});
  const baseLat=Math.floor(lat*500),baseLon=Math.floor(lon*500),cells=[];for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)cells.push(`${baseLat+a}:${baseLon+b}`);
  const since=new Date(Date.now()-5*60000);
  const groups=await Observation.aggregate([{$match:{cell:{$in:cells},at:{$gte:since}}},{$group:{_id:{cell:'$cell',direction:'$direction'},drivers:{$addToSet:'$sessionHash'},count:{$sum:1},meanSpeed:{$avg:'$speed'}}},{$project:{_id:0,cell:'$_id.cell',direction:'$_id.direction',drivers:{$size:'$drivers'},count:1,meanSpeed:1}},{$match:{drivers:{$gte:3}}},{$limit:30}]);
  // No individual GPS positions or session identifiers are returned.
  return res.json({mode:'pilot',matching:'approximate-grid-not-road-matched',segments:groups.map(x=>({cell:x.cell,direction:x.direction,contributors:x.drivers,observations:x.count,meanSpeedKmh:Math.round(x.meanSpeed)}))});
 }catch(e){console.error('Jalan traffic failed:',e.message);return res.status(503).json({error:'Traffic service unavailable'});}
});
module.exports=router;
