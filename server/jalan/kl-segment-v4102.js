'use strict';
// Jalan Batch 3C: isolated, read-only segment-snap preview with direction-aware partial edges.
const express=require('express'),mongoose=require('mongoose');
const router=express.Router(),DB='jalan_navigation',COL='road_graph_edges_v495',COUNT=168221,R=6371000;
let graph=null,loading=null;
const rad=Math.PI/180;
function distance(a,b){const x=(b[0]-a[0])*rad,y=(b[1]-a[1])*rad,h=Math.sin(x/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function project(p,a,b){const scale=Math.cos(p[0]*rad),ax=(a[1]-p[1])*scale,ay=a[0]-p[0],dx=(b[1]-a[1])*scale,dy=b[0]-a[0];const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return {point,t,meters:distance(p,point)};}
// Read-only access caution for OSM-tagged roads. This is diagnostic only:
// destination/customer/permit restrictions depend on trip purpose and legal context.
const ACCESS_CAUTION=new Set(['destination','customers','permit','private','no','delivery']);
function accessCaution(e){return [e.access,e.vehicle,e.motorVehicle].some(v=>ACCESS_CAUTION.has(String(v||'').toLowerCase()));}
function pilot(p){return p.every(Number.isFinite)&&p[0]>=2.5&&p[0]<=3.8&&p[1]>=100.8&&p[1]<=102.3;}
class Heap{constructor(){this.a=[];}push(x){const a=this.a;let i=a.length;a.push(x);while(i){const j=(i-1)>>1;if(a[j].d<=x.d)break;a[i]=a[j];i=j;}a[i]=x;}pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1].d<a[j].d)j++;if(a[j].d>=last.d)break;a[i]=a[j];i=j;}a[i]=last;}return first;}}
async function load(){if(graph)return graph;if(loading)return loading;loading=(async()=>{const col=mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL);if(await col.countDocuments()!==COUNT)throw Error('Graph count mismatch');const adj=new Map(),edges=[];for await(const e of col.find({},{projection:{edgeId:1,fromNode:1,toNode:1,coordinates:1,access:1,vehicle:1,motorVehicle:1}}).batchSize(1000)){if(!e.edgeId||!e.fromNode||!e.toNode||!Array.isArray(e.coordinates)||e.coordinates.length!==2)throw Error('Invalid edge');const a=[e.coordinates[0][1],e.coordinates[0][0]],b=[e.coordinates[1][1],e.coordinates[1][0]];if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('Invalid geometry');const edge={id:e.edgeId,from:String(e.fromNode),to:String(e.toNode),a,b,len:distance(a,b),potentialAccessCaution:accessCaution(e)};edges.push(edge);if(!adj.has(edge.from))adj.set(edge.from,[]);adj.get(edge.from).push(edge);}if(edges.length!==COUNT)throw Error('Graph changed');return {adj,edges};})();try{graph=await loading;return graph;}finally{loading=null;}}
function nearest(edges,p){let best=null;for(const e of edges){
// Test the whole segment envelope, not just its endpoints: a long segment may cross the GPS point.
if(p[0]<Math.min(e.a[0],e.b[0])-.007||p[0]>Math.max(e.a[0],e.b[0])+.007)continue;
if(p[1]<Math.min(e.a[1],e.b[1])-.007||p[1]>Math.max(e.a[1],e.b[1])+.007)continue;
const x=project(p,e.a,e.b);if(!best||x.meters<best.meters)best={edge:e,...x};}return best;}
function calculate(g,s,t){const START='@start',END='@end',extra=new Map();
function add(from,to,len,coords,id,potentialAccessCaution=false){if(!extra.has(from))extra.set(from,[]);extra.get(from).push({to,len,coords,id,potentialAccessCaution});}
const sEdge=s.edge,tEdge=t.edge;
add(START,sEdge.to,sEdge.len*(1-s.t),[s.point,sEdge.b],sEdge.id,!!sEdge.potentialAccessCaution);
add(tEdge.from,END,tEdge.len*t.t,[tEdge.a,t.point],tEdge.id,!!tEdge.potentialAccessCaution);
if(sEdge.id===tEdge.id&&s.t<=t.t)add(START,END,sEdge.len*(t.t-s.t),[s.point,t.point],sEdge.id,!!sEdge.potentialAccessCaution);
const heap=new Heap(),dist=new Map([[START,0]]),prev=new Map();heap.push({n:START,d:0});let visited=0;
// A directed graph with E edges may have up to 2E distinct nodes. The former fixed
// 150,000-node guard could reject valid routes in the 168,221-edge pilot graph.
const edgeCount=g.edges.length;
const visitLimit=Math.min(400000,Math.max(150000,2*edgeCount+2));
while(heap.a.length){const cur=heap.pop();if(cur.d!==dist.get(cur.n))continue;if(++visited>visitLimit)throw Error('Search visit limit');if(cur.n===END)break;
const next=[...(extra.get(cur.n)||[])];for(const e of g.adj.get(cur.n)||[])next.push({to:e.to,len:e.len,coords:[e.a,e.b],id:e.id,potentialAccessCaution:!!e.potentialAccessCaution});
for(const e of next){const nd=cur.d+e.len;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:cur.n,e});heap.push({n:e.to,d:nd});}}
}
if(!dist.has(END))return null;const path=[];let n=END;while(n!==START){const p=prev.get(n);if(!p||path.length>COUNT)throw Error('Path reconstruction');path.push(p.e);n=p.from;}path.reverse();const geometry=[];for(const e of path){for(const p of e.coords){const q=[p[1],p[0]],last=geometry[geometry.length-1];if(!last||last[0]!==q[0]||last[1]!==q[1])geometry.push(q);}}
if (geometry.length === 1) geometry.push([...geometry[0]]); // GeoJSON LineString requires at least two positions
return {geometry,distanceMeters:Math.round(dist.get(END)),edgeCount:path.length,visited,potentialAccessReviewEdges:path.filter(e=>e.potentialAccessCaution).length};}
router.get('/health',async(req,res)=>{try{const n=await mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL).countDocuments();res.json({ok:n===COUNT,mode:'kl-segment-preview-v4.10.2',graphEdges:n,readOnly:true,graphCached:!!graph,liveRouting:false});}catch(e){res.status(503).json({ok:false,error:'Graph unavailable'});}});
router.get('/route',async(req,res)=>{try{const s=[Number(req.query.startLat),Number(req.query.startLng)],t=[Number(req.query.endLat),Number(req.query.endLng)];if(!pilot(s)||!pilot(t))return res.status(400).json({ok:false,error:'Both coordinates must be in the KL pilot region'});const g=await load(),a=nearest(g.edges,s),b=nearest(g.edges,t);if(!a||!b||a.meters>200||b.meters>200)return res.status(422).json({ok:false,error:'No nearby directed graph segment within 200 m',startSnapMeters:a?Math.round(a.meters):null,endSnapMeters:b?Math.round(b.meters):null});const r=calculate(g,a,b);if(!r)return res.status(404).json({ok:false,error:'No directed path found'});res.json({ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',geometry:{type:'LineString',coordinates:r.geometry},...r,startSnapMeters:Math.round(a.meters),endSnapMeters:Math.round(b.meters),illustrativeEtaMinutes:Math.round(r.distanceMeters/1000/30*60*10)/10,etaAssumedSpeedKmh:30,trafficAware:false,accessRestrictionsEnforced:false,turnRestrictionsEnforced:false,legalDrivingRouteVerified:false,routingActivated:false,databaseWrites:0});}catch(e){console.error('KL 3C:',e.message);res.status(503).json({ok:false,error:'KL preview temporarily unavailable'});}});
module.exports={router,project,nearest,calculate,distance,accessCaution};
