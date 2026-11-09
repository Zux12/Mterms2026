'use strict';
// Read-only geographically distributed KL routing diagnostic, not road legality certification.
require('dotenv').config();
const mongoose=require('mongoose');
const {normalize,indexEdges,compileViaNode}=require('./audit-road-rules-v3d');
const {compileViaWay,buildAdj}=require('./test-road-rules-v3e');
const {astar}=require('./test-jalan-batch4a2');
const DB='jalan_navigation', EDGES='road_graph_edges_v495', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493';
const RAD=Math.PI/180;
function meters(a,b){const x=(b[0]-a[0])*RAD,y=(b[1]-a[1])*RAD,h=Math.sin(y/2)**2+Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*Math.sin(x/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));}
const anchors=[
 ['KLCC',101.7125,3.1578],['Bukit Bintang',101.7114,3.1467],['KL Sentral',101.6868,3.1340],
 ['Merdeka Square',101.6936,3.1478],['Chow Kit',101.6983,3.1633],['Titiwangsa',101.7058,3.1734],
 ['Bangsar',101.6707,3.1295],['Mid Valley',101.6760,3.1174],['Pudu',101.7140,3.1360],
 ['Cheras',101.7315,3.1120],['Setapak',101.7238,3.2040],['Mont Kiara',101.6528,3.1650],
 ['Damansara Heights',101.6642,3.1450],['Ampang',101.7595,3.1490],['Sungai Besi',101.7065,3.0800]
];
function selfTest(){const tests=[
 ['15 distributed KL reference anchors',anchors.length===15],
 ['coordinates valid',anchors.every(x=>x[1]>100&&x[1]<103&&x[2]>2&&x[2]<4)],
 ['geodesic distance symmetric',Math.abs(meters([101.7,3.1],[101.8,3.2])-meters([101.8,3.2],[101.7,3.1]))<.00001],
 ['same point zero',meters([101.7,3.1],[101.7,3.1])===0],
 ['no route write mode',!process.argv.includes('--write')],
 ['A* function available',typeof astar==='function'],
 ['distinct anchor names',new Set(anchors.map(x=>x[0])).size===anchors.length],
 ['distance over 2km',meters([101.7,3.1],[101.72,3.12])>2000]
 ];const passed=tests.filter(x=>x[1]).length;console.log(JSON.stringify({ok:passed===tests.length,mode:'BATCH4A3_SELF_TEST',passed,total:tests.length,tests:tests.map(([name,pass])=>({name,pass})),databaseWrites:0},null,2));if(passed!==tests.length)process.exitCode=1;}
function nearest(coords,target){let best=null,d=Infinity;for(const [id,p] of coords){const dx=Math.abs(p[0]-target[0]),dy=Math.abs(p[1]-target[1]);if(dx>.025||dy>.025)continue;const m=meters(p,target);if(m<d){d=m;best=id;}}return {node:best,snapMeters:Math.round(d)};}
async function database(){if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();try{
 if(conn.name!==DB)throw Error('Wrong database');const db=conn.db;
 const [ec,rc,qc]=await Promise.all([db.collection(EDGES).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
 if(ec!==168221||rc!==1941||qc!==45)throw Error('Source counts changed; stop');
 const [edges,restrictions]=await Promise.all([db.collection(EDGES).find({},{projection:{_id:0,edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1}}).toArray(),db.collection(RESTR).find({},{projection:{_id:0,restrictionId:1,restriction:1,fromWay:1,toWay:1,viaNodes:1,viaWays:1,conditional:1}}).toArray()]);
 const coords=new Map();for(const e of edges){if(!Array.isArray(e.coordinates)||e.coordinates.length!==2)throw Error('Bad edge geometry');e.weight=meters(e.coordinates[0],e.coordinates[1]);if(!coords.has(e.fromNode))coords.set(e.fromNode,e.coordinates[0]);if(!coords.has(e.toNode))coords.set(e.toNode,e.coordinates[1]);}
 const norm=restrictions.map(normalize),idx=indexEdges(edges),viaNode=compileViaNode(norm,idx),viaWay=compileViaWay(norm,idx.ways),adj=buildAdj(edges);
 const points=anchors.map(x=>({name:x[0],...nearest(coords,[x[1],x[2]])}));
 // 24 deterministic, geographically diverse ordered pairs; not claims about live roads or OSRM.
 const pairs=[];for(let i=0;i<24;i++){const a=i%15,b=(i*7+5)%15;if(a===b)continue;pairs.push([a,b]);}
 const reports=[];for(let i=0;i<pairs.length;i++){
  const [a,b]=pairs[i],start=points[a],end=points[b];if(!start.node||!end.node){reports.push({case:i+1,from:start.name,to:end.name,status:'NO_NEARBY_GRAPH_NODE'});continue;}
  const t=Date.now(),r=astar(adj,start.node,end.node,viaNode.rules,viaWay,coords,{maxVisited:18000});
  reports.push({case:i+1,from:start.name,to:end.name,fromNode:start.node,toNode:end.node,startSnapMeters:start.snapMeters,endSnapMeters:end.snapMeters,status:r.found?'FOUND':r.limitReached?'SEARCH_LIMIT':'NO_PATH',distanceMeters:r.found?r.distanceMeters:null,directMeters:Math.round(meters(coords.get(start.node),coords.get(end.node))),detourRatio:r.found?Number((r.distanceMeters/Math.max(1,meters(coords.get(start.node),coords.get(end.node)))).toFixed(2)):null,visited:r.visited,elapsedMs:Date.now()-t,blockedViaNode:r.blockedViaNode,blockedViaWay:r.blockedViaWay,flagForReview:!r.found||start.snapMeters>200||end.snapMeters>200||(r.found&&r.distanceMeters/Math.max(1,meters(coords.get(start.node),coords.get(end.node)))>3)});
 }
 const output={ok:true,mode:'BATCH4A3_CITYWIDE_DIAGNOSTIC',counts:{edges:ec,restrictions:rc,quarantine:qc},cases:reports.length,found:reports.filter(x=>x.status==='FOUND').length,searchLimited:reports.filter(x=>x.status==='SEARCH_LIMIT').length,noPath:reports.filter(x=>x.status==='NO_PATH').length,flagged:reports.filter(x=>x.flagForReview).length,points,reports,osrmComparison:'NOT RUN: no OSRM reference route data supplied or fetched',legalDrivingRouteVerified:false,liveRoutingActivated:false,databaseWrites:0,caveats:['Long-distance A* uses provisional via-way road-ID sequence rules.','Anchor coordinates are approximate test locations, not verified driving start points.','No actual OSRM routes fetched or compared.','High detour ratio is a review flag, not proof of illegal turn.','No physical median, barriers, conditional rules or lane restrictions verified.','Do not use experimental route for driving.']};console.log(JSON.stringify(output,null,2));
}finally{await conn.close();}}
if(require.main===module){const args=process.argv.slice(2);if(args.some(x=>x!=='--self-test')){console.error('Usage: node scripts/test-jalan-batch4a3.js [--self-test]');process.exit(1);}(args.includes('--self-test')?Promise.resolve().then(selfTest):database()).catch(e=>{console.error('BATCH4A3 FAILED:',e.stack||e.message);process.exitCode=1;});}
module.exports={meters,anchors,nearest};
