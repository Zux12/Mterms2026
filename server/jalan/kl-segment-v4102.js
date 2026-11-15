'use strict';
// Jalan Batch 3C: isolated, read-only segment-snap preview with direction-aware partial edges.
const express=require('express'),mongoose=require('mongoose');
const router=express.Router(),DB='jalan_navigation',COL='road_graph_edges_v495',COUNT=168221,R=6371000;
let graph=null,loading=null;
const rad=Math.PI/180;
function distance(a,b){const x=(b[0]-a[0])*rad,y=(b[1]-a[1])*rad,h=Math.sin(x/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
function project(p,a,b){const scale=Math.cos(p[0]*rad),ax=(a[1]-p[1])*scale,ay=a[0]-p[0],dx=(b[1]-a[1])*scale,dy=b[0]-a[0];const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));const point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];return {point,t,meters:distance(p,point)};}
function pilot(p){return p.every(Number.isFinite)&&p[0]>=2.5&&p[0]<=3.8&&p[1]>=100.8&&p[1]<=102.3;}
class Heap{constructor(){this.a=[];}push(x){const a=this.a;let i=a.length;a.push(x);while(i){const j=(i-1)>>1;if(a[j].d<=x.d)break;a[i]=a[j];i=j;}a[i]=x;}pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1].d<a[j].d)j++;if(a[j].d>=last.d)break;a[i]=a[j];i=j;}a[i]=last;}return first;}}
async function load(){if(graph)return graph;if(loading)return loading;loading=(async()=>{const col=mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL);if(await col.countDocuments()!==COUNT)throw Error('Graph count mismatch');const adj=new Map(),edges=[];for await(const e of col.find({},{projection:{edgeId:1,fromNode:1,toNode:1,coordinates:1}}).batchSize(1000)){if(!e.edgeId||!e.fromNode||!e.toNode||!Array.isArray(e.coordinates)||e.coordinates.length!==2)throw Error('Invalid edge');const a=[e.coordinates[0][1],e.coordinates[0][0]],b=[e.coordinates[1][1],e.coordinates[1][0]];if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('Invalid geometry');const edge={id:e.edgeId,from:String(e.fromNode),to:String(e.toNode),a,b,len:distance(a,b)};edges.push(edge);if(!adj.has(edge.from))adj.set(edge.from,[]);adj.get(edge.from).push(edge);}if(edges.length!==COUNT)throw Error('Graph changed');return {adj,edges};})();try{graph=await loading;return graph;}finally{loading=null;}}
function nearest(edges,p){let best=null;for(const e of edges){if(Math.abs(e.a[0]-p[0])>.007&&Math.abs(e.b[0]-p[0])>.007)continue;if(Math.abs(e.a[1]-p[1])>.007&&Math.abs(e.b[1]-p[1])>.007)continue;const x=project(p,e.a,e.b);if(!best||x.meters<best.meters)best={edge:e,...x};}return best;}
function calculate(g,s,t){const START='@start',END='@end',extra=new Map();
function add(from,to,len,coords,id){if(!extra.has(from))extra.set(from,[]);extra.get(from).push({to,len,coords,id});}
const sEdge=s.edge,tEdge=t.edge;
add(START,sEdge.to,sEdge.len*(1-s.t),[s.point,sEdge.b],sEdge.id);
add(tEdge.from,END,tEdge.len*t.t,[tEdge.a,t.point],tEdge.id);
if(sEdge.id===tEdge.id&&s.t<=t.t)add(START,END,sEdge.len*(t.t-s.t),[s.point,t.point],sEdge.id);
const heap=new Heap(),dist=new Map([[START,0]]),prev=new Map();heap.push({n:START,d:0});let visited=0;
while(heap.a.length){const cur=heap.pop();if(cur.d!==dist.get(cur.n))continue;if(++visited>150000)throw Error('Search visit limit');if(cur.n===END)break;
const next=[...(extra.get(cur.n)||[])];for(const e of g.adj.get(cur.n)||[])next.push({to:e.to,len:e.len,coords:[e.a,e.b],id:e.id});
for(const e of next){const nd=cur.d+e.len;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:cur.n,e});heap.push({n:e.to,d:nd});}}
}
if(!dist.has(END))return null;const path=[];let n=END;while(n!==START){const p=prev.get(n);if(!p||path.length>COUNT)throw Error('Path reconstruction');path.push(p.e);n=p.from;}path.reverse();const geometry=[];for(const e of path){for(const p of e.coords){const q=[p[1],p[0]],last=geometry[geometry.length-1];if(!last||last[0]!==q[0]||last[1]!==q[1])geometry.push(q);}}
return {geometry,distanceMeters:Math.round(dist.get(END)),edgeCount:path.length,visited};}
router.get('/health',async(req,res)=>{try{const n=await mongoose.connection.useDb(DB,{useCache:true}).db.collection(COL).countDocuments();res.json({ok:n===COUNT,mode:'kl-segment-preview-v4.10.2',graphEdges:n,readOnly:true,graphCached:!!graph,liveRouting:false});}catch(e){res.status(503).json({ok:false,error:'Graph unavailable'});}});
// JSON-body coordinates avoid route coordinates in default router URL logs.
// Original Mterms still parses JSON globally (5 MB) before mounting /api/jalan:
// a declared-size check runs AFTER that parser; requests without Content-Length
// are accepted when well-formed, but all parsing retains the upstream 5 MB
// limit. This is NOT a 1 KB raw cap or a server log-redaction guarantee.
// Legacy GET remains accessible to direct clients and needs separate mitigation.
function parsePostedCoordinates(req){
 const b=req.body,keys=b&&typeof b==='object'&&!Array.isArray(b)?Object.keys(b).sort():[];
 if(!req.is('application/json')||Object.keys(req.query||{}).length||
    keys.join('|')!=='endLat|endLng|startLat|startLng')return null;
 if(JSON.stringify(b).length>512||
    keys.some(k=>typeof b[k]!=='number'||!Number.isFinite(b[k])))return null;
 return {start:[b.startLat,b.startLng],end:[b.endLat,b.endLng]};
}
// Browsers cannot set Content-Length, and proxies may legally forward framed
// request bodies without it (e.g. chunked transfer or HTTP/2 translation).
// Only reject an explicitly declared body size above 1024 bytes; absent length
// is NOT a raw-size guarantee. The original shared app's upstream 5 MB parser
// still handles all bodies BEFORE this policy. A strict 1 KB ingress limit
// would require a separately reviewed pre-parser change in original Mterms.
// Parsed payload shape/finite-number/canonical-size validation remains mandatory.
function postTransportPolicy(req,res,next){
 const type=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
 if(type!=='application/json')return res.status(415).json({ok:false,error:'JSON content type required'});
 const encoding=String(req.headers['content-encoding']||'identity').trim().toLowerCase();
 if(encoding!=='identity')return res.status(415).json({ok:false,error:'Compressed JSON is not supported'});
 const declared=req.headers['content-length'];
 if(declared!==undefined){
   if(!/^[1-9][0-9]*$/.test(String(declared)))return res.status(400).json({ok:false,error:'Invalid Content-Length'});
   if(Number(declared)>1024)return res.status(413).json({ok:false,error:'Declared JSON route request exceeds 1024 bytes'});
 }
 next();
}
async function handleRoute(req,res){try{
 const posted=req.method==='POST'?parsePostedCoordinates(req):null;
 if(req.method==='POST'&&!posted)return res.status(400).json({ok:false,error:'Four numeric JSON coordinates required; URL query not accepted'});
 const s=posted?posted.start:[Number(req.query.startLat),Number(req.query.startLng)],
       t=posted?posted.end:[Number(req.query.endLat),Number(req.query.endLng)];if(!pilot(s)||!pilot(t))return res.status(400).json({ok:false,error:'Both coordinates must be in the KL pilot region'});const g=await load(),a=nearest(g.edges,s),b=nearest(g.edges,t);if(!a||!b||a.meters>200||b.meters>200)return res.status(422).json({ok:false,error:'No nearby directed graph segment within 200 m',startSnapMeters:a?Math.round(a.meters):null,endSnapMeters:b?Math.round(b.meters):null});const r=calculate(g,a,b);if(!r)return res.status(404).json({ok:false,error:'No directed path found'});res.json({ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',geometry:{type:'LineString',coordinates:r.geometry},...r,startSnapMeters:Math.round(a.meters),endSnapMeters:Math.round(b.meters),illustrativeEtaMinutes:Math.round(r.distanceMeters/1000/30*60*10)/10,etaAssumedSpeedKmh:30,trafficAware:false,turnRestrictionsEnforced:false,legalDrivingRouteVerified:false,routingActivated:false,databaseWrites:0});}catch(e){console.error('KL 3C:',e.message);res.status(503).json({ok:false,error:'KL preview temporarily unavailable'});}}
// Apply to *all* GET/POST responses including transport-policy 400/413/415.
router.use('/route',(req,res,next)=>{
 res.set('Cache-Control','no-store');
 res.set('Referrer-Policy','no-referrer');
 res.set('X-Content-Type-Options','nosniff');
 // Sharing this Heroku app must not implicitly activate a location-processing
 // endpoint. An operator must deliberately enable it after privacy/access review.
 // A disabled endpoint still cannot erase router logs from direct URL requests.
 if(process.env.JALAN_SHARED_KL_PREVIEW_ENABLED!=='true')
  return res.status(503).json({ok:false,error:'Experimental KL preview is not enabled'});
 next();
});
// Retire legacy URL-coordinate GET when this preview is deliberately activated.
// The old original-Mterms/main deployment still accepts GET until a separately
// approved release; even a 410 response cannot prevent Heroku's router from
// logging URL query parameters already received. Operator log redaction remains
// a separate hard release gate.
router.get('/route',(_req,res)=>res.status(410).json({
 ok:false,error:'Coordinate GET preview retired; use reviewed JSON POST transport'
}));
router.post('/route',postTransportPolicy,handleRoute); // no GET fallback
module.exports={router,project,calculate,distance,parsePostedCoordinates};
