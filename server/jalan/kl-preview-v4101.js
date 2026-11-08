'use strict';
// V4.10.1: read-only route preview diagnostics. No live routing activation.
const express=require('express');
const mongoose=require('mongoose');
const {router:oldRouter}=require('./kl-preview-v4100');
const router=express.Router();
const DB='jalan_navigation', COL='road_graph_edges_v495';
const R=6371000;
function meters(a,b){const p=Math.PI/180, x=(b[0]-a[0])*p,y=(b[1]-a[1])*p;const h=Math.sin(x/2)**2+Math.cos(a[0]*p)*Math.cos(b[0]*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function project(point, a, b) {
  // [latitude,longitude] points, local tangent-plane approximation.
  const lat=point[0]*Math.PI/180, scale=Math.cos(lat);
  const ax=(a[1]-point[1])*scale, ay=a[0]-point[0];
  const bx=(b[1]-point[1])*scale, by=b[0]-point[0];
  const dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
  const q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  return {point:q,meters:meters(point,q),fraction:t};
}
function valid(p){return p.length===2&&p.every(Number.isFinite)&&p[0]>=2.5&&p[0]<=3.8&&p[1]>=100.8&&p[1]<=102.3;}
async function nearestSegment(point){
  const db=mongoose.connection.useDb(DB,{useCache:true});
  const lng=point[1],lat=point[0],d=.004;
  // Bounded geospatial search. Indexed geo-query against existing 2dsphere edge? 
  // Edges collection has no geo index, so use a read-only scan with projected fields.
  let best={meters:Infinity};
  for await(const e of db.db.collection(COL).find({},{projection:{coordinates:1,edgeId:1}}).batchSize(2000)){
    const c=e.coordinates;if(!Array.isArray(c)||c.length!==2)continue;
    if(!c.some(p=>Math.abs(p[0]-lng)<d&&Math.abs(p[1]-lat)<d))continue;
    const p=project(point,[c[0][1],c[0][0]],[c[1][1],c[1][0]]);
    if(p.meters<best.meters)best={...p,edgeId:e.edgeId};
  }
  return best;
}
router.get('/health',async(req,res)=>{try{const count=await mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL).countDocuments();res.json({ok:count===168221,mode:'kl-preview-diagnostics-v4.10.1',graphEdges:count,readOnly:true,trafficAware:false,autoReroutingActivated:false});}catch(e){res.status(503).json({ok:false,error:'Graph unavailable'});}});
router.get('/snap',async(req,res)=>{try{
  const p=[Number(req.query.lat),Number(req.query.lng)];
  if(!valid(p))return res.status(400).json({ok:false,error:'Point outside KL pilot'});
  const s=await nearestSegment(p);
  if(!Number.isFinite(s.meters)||s.meters>500)return res.status(422).json({ok:false,error:'No nearby graph segment'});
  res.json({ok:true,segmentSnapMeters:Math.round(s.meters),edgeId:s.edgeId,nearestPoint:{lat:s.point[0],lng:s.point[1]},note:'Diagnostic geometric snap only; route endpoint remains node-snapped',databaseWrites:0});
 }catch(e){res.status(503).json({ok:false,error:'Snap diagnostic unavailable'});}});
router.use('/',oldRouter);
module.exports={router,project};
