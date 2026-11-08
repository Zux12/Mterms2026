'use strict';
// Jalan Batch 2: read-only road-rule, GPS matching and maneuver diagnostics.
require('dotenv').config();
const mongoose=require('mongoose');
const DB='jalan_navigation';
const EDGES='road_graph_edges_v495', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--self-test')){console.error('Usage: node scripts/test-jalan-batch2.js [--self-test]');process.exit(1);}
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;
const norm=d=>(d%360+360)%360;
function bearing(a,b){const p=rad(a[1]),q=rad(b[1]),dl=rad(b[0]-a[0]);return norm(deg(Math.atan2(Math.sin(dl)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(dl))));}
function maneuver(a,b,c){const incoming=bearing(a,b),outgoing=bearing(b,c),delta=((outgoing-incoming+540)%360)-180;const abs=Math.abs(delta);return {deltaDegrees:Math.round(delta),instruction:abs<25?'straight':abs>155?'u-turn':delta>0?'right':'left'};}
// Approximate planar projection for short local GPS-to-segment diagnostics; not production map matching.
function project(point,a,b){const lat0=rad(point[1]);const kx=111320*Math.cos(lat0),ky=110540;const ax=(a[0]-point[0])*kx,ay=(a[1]-point[1])*ky,bx=(b[0]-point[0])*kx,by=(b[1]-point[1])*ky;const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;const t=den?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;return {distanceMeters:Math.hypot(ax+t*dx,ay+t*dy),fraction:t};}
function match(point,edges,heading){const matches=edges.filter(e=>Array.isArray(e.coordinates)&&e.coordinates.length===2).map(e=>{const p=project(point,e.coordinates[0],e.coordinates[1]);const b=bearing(e.coordinates[0],e.coordinates[1]);const headingDelta=heading==null?null:Math.abs(((b-heading+540)%360)-180);return {edgeId:e.edgeId,roadId:e.roadId,distanceMeters:p.distanceMeters,headingDelta,score:p.distanceMeters+(headingDelta==null?0:headingDelta*0.25)};});matches.sort((a,b)=>a.score-b.score);return matches[0]||null;}
function restrictionSummary(r){return {id:r.restrictionId,type:r.restriction||'',viaWay:Array.isArray(r.viaWays)&&r.viaWays.length>0,conditional:!!r.conditional,applicability:r.applicability||'',fromWay:r.fromWay||'',toWay:r.toWay||''};}
function output(mode,tests,extra={}){const passed=tests.filter(t=>t.pass).length;const result={ok:passed===tests.length,mode,passed,total:tests.length,tests,...extra,databaseWrites:0,routingActivated:false,turnRestrictionsEnforced:false,legalDrivingRouteVerified:false};console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=2;}
function selfTest(){const A=[101.7,3.1],N=[101.7,3.101],E=[101.701,3.101],W=[101.699,3.101],S=[101.7,3.1];const sample=[{edgeId:'east',roadId:'r1',coordinates:[N,E]},{edgeId:'west',roadId:'r2',coordinates:[E,N]}];const tests=[
 {name:'straight maneuver',pass:maneuver(A,N,[101.7,3.102]).instruction==='straight'},
 {name:'right maneuver',pass:maneuver(A,N,E).instruction==='right'},
 {name:'left maneuver',pass:maneuver(A,N,W).instruction==='left'},
 {name:'u-turn maneuver',pass:maneuver(A,N,S).instruction==='u-turn'},
 {name:'point on segment distance',pass:project([101.7005,3.101],N,E).distanceMeters<1},
 {name:'distant point positive distance',pass:project([101.7,3.102],N,E).distanceMeters>100},
 {name:'GPS heading selects directed edge',pass:match([101.7005,3.101],sample,90).edgeId==='east'},
 {name:'reverse heading selects reverse edge',pass:match([101.7005,3.101],sample,270).edgeId==='west'},
 {name:'via-way restriction classified',pass:restrictionSummary({restrictionId:'x',viaWays:['way1']}).viaWay===true},
 {name:'conditional restriction classified',pass:restrictionSummary({restrictionId:'x',conditional:'Mo-Fr'}).conditional===true}
 ];output('BATCH2_SYNTHETIC',tests,{syntheticOnly:true});}
async function databaseTest(){if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();try{if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;
 const [edgeCount,restrictionCount,quarantineCount,restrictionSamples,edgeSamples]=await Promise.all([
 db.collection(EDGES).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments(),
 db.collection(RESTR).find({}).limit(3000).toArray(),db.collection(EDGES).find({coordinates:{$exists:true}},{projection:{edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1}}).limit(500).toArray()
 ]);
 const via=restrictionSamples.filter(r=>Array.isArray(r.viaWays)&&r.viaWays.length).length,conditional=restrictionSamples.filter(r=>!!r.conditional).length;
 const malformed=restrictionSamples.filter(r=>!r.restrictionId||!r.fromWay||!r.toWay||(!r.viaNodes?.length&&!r.viaWays?.length)).length;
 const coordsValid=edgeSamples.filter(e=>e.coordinates?.length===2&&e.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
 const sample=coordsValid.find(e=>e.coordinates[0][0]!==e.coordinates[1][0]||e.coordinates[0][1]!==e.coordinates[1][1]);
 let gps=null;if(sample){const midpoint=[(sample.coordinates[0][0]+sample.coordinates[1][0])/2,(sample.coordinates[0][1]+sample.coordinates[1][1])/2];gps=match(midpoint,coordsValid.slice(0,100),bearing(sample.coordinates[0],sample.coordinates[1]));}
 const tests=[
 {name:'expected graph edge count',pass:edgeCount===168221},
 {name:'expected restriction count',pass:restrictionCount===1941},
 {name:'quarantine preserved',pass:quarantineCount===45},
 {name:'restriction references structurally present',pass:malformed===0},
 {name:'via-way restrictions detected',pass:via>0},
 {name:'conditional restrictions detected',pass:conditional>0},
 {name:'sampled edge geometries valid',pass:edgeSamples.length>0&&coordsValid.length===edgeSamples.length},
 {name:'GPS nearest-edge diagnostic runs',pass:!!gps&&Number.isFinite(gps.distanceMeters)}
 ];output('BATCH2_DATABASE_AUDIT',tests,{database:DB,sourceCollections:[EDGES,RESTR,QUAR],counts:{edges:edgeCount,restrictions:restrictionCount,quarantine:quarantineCount},restrictionDiagnostics:{viaWayRecords:via,conditionalRecords:conditional,malformedRecords:malformed},gpsSample:gps&&{edgeId:gps.edgeId,distanceMeters:Math.round(gps.distanceMeters*100)/100,headingDelta:Math.round(gps.headingDelta)},sampledEdges:edgeSamples.length,caveats:['Read-only diagnostic; restrictions are classified, not applied to routing.','GPS matching is a local geometric/heading heuristic, not a production map matcher.','Instructions use synthetic three-point geometry; no route instruction pipeline is connected.','No barrier, turn restriction, conditional access or legal driving verification.']});
 }finally{await conn.close();}}
if(require.main===module){if(args.includes('--self-test'))selfTest();else databaseTest().catch(e=>{console.error('BATCH2 FAILED:',e.message);process.exitCode=1;});}
module.exports={bearing,maneuver,project,match,restrictionSummary};
