'use strict';
// Trusted CI only. Probes genuine, authenticated loopback HTTP replies against
// the complete imported read-only KL graph. No private GPS, route JSON, or
// credentials are printed or stored. Does NOT certify legal driving directions.
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {setTimeout:delay}=require('node:timers/promises');
const path=require('node:path');
const port=18867,token=randomBytes(32).toString('hex');
const base='http://127.0.0.1:'+port;
const heads={'x-jalan-preview-token':token,'cache-control':'no-store'};
const ROOT=168221;
const route=([a,b,c,d])=>'/api/jalan/kl/route?'+new URLSearchParams({
 startLat:String(a),startLng:String(b),endLat:String(c),endLng:String(d)
});
async function main(){
 if(!process.env.JALAN_READONLY_MONGODB_URI)
  throw Error('read-only-graph-credential-unavailable');
 const child=spawn(process.execPath,[path.join(__dirname,'run-kl-preview-local.js')],{
  env:{...process.env,JALAN_PREVIEW_PORT:String(port),JALAN_PREVIEW_TOKEN:token},
  stdio:'ignore'
 });
 async function probe(uri,timeout=65000){
  const response=await fetch(base+uri,{headers:heads,redirect:'error',
   cache:'no-store',signal:AbortSignal.timeout(timeout)});
  const body=await response.json();
  if(response.headers.get('cache-control')!=='no-store'||
     response.headers.get('x-powered-by')!==null)
   throw Error('private-response-headers-invalid');
  if(body.mode!=='EXPERIMENTAL_SEGMENT_ROUTE'||
     body.routingActivated!==false||body.databaseWrites!==0||
     body.trafficAware!==false||body.legalDrivingRouteVerified!==false||
     body.accessRestrictionsEnforced!==false||
     body.turnRestrictionsEnforced!==false)
   throw Error('advisory-route-contract-invalid');
  return {status:response.status,body};
 }
 try{
  let ready=false;
  for(let i=0;i<45;i++){
   if(child.exitCode!==null)throw Error('private-preview-exited');
   try{if((await fetch(base+'/',{signal:AbortSignal.timeout(2500)})).ok){ready=true;break;}}catch{}
   await delay(1000);
  }
  if(!ready)throw Error('preview-startup-timeout');
  const valid=await probe(route([
   3.1315707,101.7038508,3.1314573,101.7038951]),120000);
  if(valid.status!==200||valid.body.ok!==true||valid.body.graphVersion!=='road_graph_edges_v495'||
     valid.body.graphEdges!==ROOT||valid.body.distanceMeters!==17||
     valid.body.geometry?.type!=='LineString')
   throw Error('fullgraph-http-200-contract-failed');
  console.log('Verified authentic fullgraph HTTP 200 with 168221 imported directed edges (no GPS recorded).');
  // A known synthetic *input* point outside the KL imported area but within
  // the guard rectangle; 422 must carry full-graph evidence and no legal approval.
  const far=await probe(route([
   3.1315707,101.7038508,2.51,100.81]),120000);
  if(far.status!==422||far.body.ok!==false||
     far.body.graphEdges!==ROOT||far.body.graphVersion!=='road_graph_edges_v495'||
     far.body.error!=='No nearby directed graph segment within 200 m'||
     !Number.isFinite(far.body.endSnapMeters)&&far.body.endSnapMeters!==null)
   throw Error('fullgraph-http-422-contract-failed');
  console.log('Verified genuine HTTP 422 missing-snap advisory flags and graph provenance.');
  // Public OSM sink-only start candidate, not a driver GPS track. The graph's
  // nearest-edge snapping can legally choose another coincident road, so a
  // reachable 200 response is NOT an assertion that this sample is disconnected.
  const noPathCandidate=await probe(route([
   3.13871,101.7208629,3.1315707,101.7038508]),120000);
  if(noPathCandidate.status===404){
   const b=noPathCandidate.body;
   if(b.ok!==false||b.error!=='No directed path found'||
      b.graphEdges!==ROOT||b.graphVersion!=='road_graph_edges_v495')
    throw Error('fullgraph-http-404-contract-failed');
   console.log('Observed actual imported-graph HTTP 404 disconnection with fail-closed advisory provenance.');
  }else if(noPathCandidate.status===200){
   if(noPathCandidate.body.ok!==true||
      noPathCandidate.body.graphEdges!==ROOT)
    throw Error('unexpected-public-OSM-probe-response');
   console.log('Public OSM disconnection candidate was reachable: no real HTTP 404 evidence established.');
  }else{
   throw Error('unexpected-public-OSM-disconnection-probe-status');
  }
  console.log('Private 200/422 HTTP contract verified; 404 evidence only if actually observed. No driving authorization.');
 }finally{
  const ended=child.exitCode!==null||child.signalCode!==null;
  const exit=ended?Promise.resolve():new Promise(resolve=>child.once('exit',resolve));
  if(!ended)child.kill('SIGTERM');
  await Promise.race([exit,delay(4000)]);
  if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
 }
}
main().catch(e=>{
 const whitelist=['read-only-graph-credential-unavailable','private-preview-exited',
 'preview-startup-timeout','private-response-headers-invalid','advisory-route-contract-invalid',
 'fullgraph-http-200-contract-failed','fullgraph-http-422-contract-failed',
 'fullgraph-http-404-contract-failed','unexpected-public-OSM-probe-response',
 'unexpected-public-OSM-disconnection-probe-status'];
 console.error('Read-only KL 200/404/422 evidence smoke failed: '+
  (whitelist.includes(e.message)?e.message:'controlled-http-probe-failed'));
 process.exitCode=1;
});