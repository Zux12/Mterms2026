'use strict';
// Jalan v4.8.8: read-only OSM endpoint topology diagnostics.
// No GPS collection, no writes, no modification of existing matching/routing.
const express = require('express');
const { Road } = require('./road-pilot');
const router = express.Router();
const MAX_ROADS = 200;
const TOLERANCE_METERS = 2.5;
function distanceMeters(a,b) {
  const rad=Math.PI/180, lat=(a[1]+b[1])*0.5*rad;
  return Math.hypot((a[0]-b[0])*111320*Math.cos(lat),(a[1]-b[1])*111320);
}
function valid(r) { return r && Array.isArray(r.geometry) && r.geometry.length>=2 && r.geometry.every(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])); }
function endpoints(r) { return [r.geometry[0],r.geometry[r.geometry.length-1]]; }
function relation(a,b,tol=TOLERANCE_METERS) {
  if(!valid(a)||!valid(b)) return {kind:'invalid-geometry'};
  const [as,ae]=endpoints(a),[bs,be]=endpoints(b);
  const combinations=[
    {a:'start',b:'start',d:distanceMeters(as,bs)},
    {a:'start',b:'end',d:distanceMeters(as,be)},
    {a:'end',b:'start',d:distanceMeters(ae,bs)},
    {a:'end',b:'end',d:distanceMeters(ae,be)}
  ];
  const near=combinations.filter(x=>x.d<=tol).sort((x,y)=>x.d-y.d);
  if(!near.length) return {kind:'not-endpoint-connected',nearestEndpointMeters:Math.round(Math.min(...combinations.map(x=>x.d))*10)/10};
  const m=near[0];
  // One-way geometry is normalized by the importer. This checks travel A -> B only.
  const aAllowsExit = !a.oneway || m.a==='end';
  const bAllowsEntry = !b.oneway || m.b==='start';
  return {kind:aAllowsExit&&bAllowsEntry?'possible-directed-connection':'direction-restricted',aEndpoint:m.a,bEndpoint:m.b,endpointDistanceMeters:Math.round(m.d*10)/10,
    caveat:'Endpoint proximity alone does not prove a traversable junction; OSM shared node IDs, access rules and bridge/layer metadata are not stored in this pilot.'};
}
function selfTest(){
 const r=(id,g,oneway=false)=>({roadId:id,geometry:g,oneway});
 const A=r('A',[[101,3],[101.001,3]],true), B=r('B',[[101.001,3],[101.002,3]],true), C=r('C',[[101.002,3],[101.001,3]],true);
 const D=r('D',[[101.001,3.0001],[101.002,3.0001]]);
 const E=r('E',[[101.001,3],[101.001,3.001]]);
 const cases=[
  ['forward one-way endpoint',relation(A,B).kind==='possible-directed-connection'],
  ['reverse one-way blocked',relation(B,A).kind==='direction-restricted'],
  ['same-end one-way blocked',relation(A,C).kind==='direction-restricted'],
  ['nearby but disconnected',relation(A,D).kind==='not-endpoint-connected'],
  ['two-way endpoint junction candidate',relation(r('T',A.geometry),E).kind==='possible-directed-connection'],
  ['invalid geometry rejected',relation({geometry:[]},B).kind==='invalid-geometry'],
  ['same coordinate different level NOT verified',relation(A,E).caveat.includes('does not prove')]
 ];
 return {ok:cases.every(x=>x[1]),passed:cases.filter(x=>x[1]).length,total:cases.length,syntheticOnly:true,databaseWrites:0,tests:cases.map(([name,pass])=>({name,pass}))};
}
router.get('/health',async(_req,res)=>{
 try {const roadCount=await Road.countDocuments({});res.json({ok:true,mode:'topology-validation-v4.8.8',roadCount,readOnly:true,liveTrafficUnchanged:true});}
 catch(e){res.status(500).json({ok:false,error:'road-query-failed'});}
});
router.get('/self-test',(_req,res)=>{const result=selfTest();res.status(result.ok?200:500).json(result);});
router.get('/sample',async(req,res)=>{
 try {
  const count=Math.min(MAX_ROADS,Math.max(2,Number.parseInt(req.query.count,10)||30));
  // Deterministic selection, bounded memory and database work.
  const roads=await Road.find({}).sort({roadId:1}).limit(count).select('roadId name highway oneway geometry').lean();
  let possible=0,restricted=0,notConnected=0,invalid=0;const examples=[];
  for(let i=0;i<roads.length;i++) for(let j=i+1;j<roads.length;j++) {
   const result=relation(roads[i],roads[j]);
   if(result.kind==='possible-directed-connection')possible++;
   else if(result.kind==='direction-restricted')restricted++;
   else if(result.kind==='invalid-geometry')invalid++;
   else notConnected++;
   if(result.kind!=='not-endpoint-connected'&&examples.length<15)examples.push({from:roads[i].roadId,to:roads[j].roadId,fromName:roads[i].name||'',toName:roads[j].name||'',...result});
  }
  res.json({ok:true,mode:'topology-validation-v4.8.8',readOnly:true,databaseWrites:0,roadSample:roads.length,pairsExamined:roads.length*(roads.length-1)/2,summary:{possibleDirectedConnections:possible,directionRestricted:restricted,notEndpointConnected:notConnected,invalidGeometry:invalid},examples,limitations:['Only endpoints of a bounded road sample are compared; not a complete road graph.','Close endpoints do not prove physical connectivity or legal turning movements.','Importer does not retain shared OSM node IDs, bridge/layer, or turn restrictions.','No real-world GPS or route accuracy is measured.']});
 }catch(e){res.status(500).json({ok:false,error:'topology-sample-failed'});}
});
module.exports={router,relation,selfTest};
