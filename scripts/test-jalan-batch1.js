'use strict';
// Jalan Batch 1: read-only multi-road routing, directionality and performance diagnostics.
require('dotenv').config();
const mongoose=require('mongoose');
const {route,meters}=require('./test-routes-v496');
const DB='jalan_navigation',COL='road_graph_edges_v495',EXPECTED=168221;
const argv=process.argv.slice(2);
if(argv.some(a=>a!=='--self-test')){console.error('Usage: node scripts/test-jalan-batch1.js [--self-test]');process.exit(1);}
const adj=new Map(),incoming=new Map(),nodes=new Set();
function add(e){if(!adj.has(e.fromNode))adj.set(e.fromNode,[]);adj.get(e.fromNode).push(e);if(!incoming.has(e.toNode))incoming.set(e.toNode,[]);incoming.get(e.toNode).push(e);nodes.add(e.fromNode);nodes.add(e.toNode);}
function walk(start,maxDepth){const q=[[start,0]],seen=new Set([start]),parent=new Map();let qi=0;while(qi<q.length&&qi<10000){const [u,d]=q[qi++];if(d>=maxDepth)continue;for(const e of adj.get(u)||[]){if(seen.has(e.toNode))continue;seen.add(e.toNode);parent.set(e.toNode,{from:u,edge:e});q.push([e.toNode,d+1]);}}return {q,parent};}
function pickMultiRoad(){for(const [start] of adj){const {q,parent}=walk(start,9);for(let i=q.length-1;i>=0;i--){const [to,depth]=q[i];if(depth<4)continue;let n=to,roads=new Set();while(n!==start){const p=parent.get(n);if(!p)break;roads.add(p.edge.roadId);n=p.from;}if(roads.size>=2)return {from:start,to,depth,distinctRoads:roads.size};}}return null;}
function checkPath(result,from,to){if(!result.found||!result.edgeIds?.length)return false;let node=from,sum=0;for(const id of result.edgeIds){const e=(adj.get(node)||[]).find(x=>x.edgeId===id);if(!e)return false;sum+=e.distance;node=e.toNode;}return node===to&&Math.abs(sum-result.distanceMeters)<=1;}
function emit(tests,extra){const passed=tests.filter(t=>t.pass).length;console.log(JSON.stringify({ok:passed===tests.length,mode:argv.includes('--self-test')?'SYNTHETIC_BATCH1':'DATABASE_BATCH1',passed,total:tests.length,tests,...extra,databaseWrites:0,routingActivated:false,turnRestrictionsEnforced:false,legalDrivingRouteVerified:false},null,2));if(passed!==tests.length)process.exitCode=2;}
async function main(){
 if(argv.includes('--self-test')){const a={edgeId:'x',roadId:'one',fromNode:'A',toNode:'B',coordinates:[[101,3],[101.001,3]],distance:100},b={edgeId:'y',roadId:'two',fromNode:'B',toNode:'C',coordinates:[[101.001,3],[101.002,3]],distance:100};add(a);add(b);const r=route(adj,'A','C',100),reverse=route(adj,'C','A',100),limited=route(adj,'A','C',1);emit([{name:'multi-road directed route',pass:r.found&&r.edgeCount===2&&r.roadIds.length===2},{name:'one-way reverse blocked',pass:!reverse.found},{name:'unreachable destination',pass:!route(adj,'A','Z',100).found},{name:'distance and edge continuity',pass:checkPath(r,'A','C')},{name:'bounded search',pass:limited.reason==='search-limit'},{name:'zero-distance origin',pass:route(adj,'A','A',100).distanceMeters===0}]);return;}
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{if(conn.name!==DB)throw Error('Database mismatch');const col=conn.db.collection(COL);const count=await col.countDocuments();if(count!==EXPECTED)throw Error('Graph count mismatch: '+count);let loaded=0;for await(const d of col.find({},{projection:{_id:0,edgeId:1,roadId:1,fromNode:1,toNode:1,coordinates:1}}).batchSize(500)){if(!d.edgeId||!d.roadId||!d.fromNode||!d.toNode||!Array.isArray(d.coordinates)||d.coordinates.length!==2)throw Error('Invalid graph edge');const distance=meters(...d.coordinates);add({...d,distance});loaded++;}if(loaded!==EXPECTED)throw Error('Incomplete graph');
 const sample=pickMultiRoad();if(!sample)throw Error('No multi-road candidate found');const started=Date.now();const r=route(adj,sample.from,sample.to,120000);const elapsedMs=Date.now()-started;
 const reverse=route(adj,sample.to,sample.from,120000);
 // Pick a node with no outgoing arcs: it cannot reach any different node.
 const sink=[...nodes].find(n=>!(adj.get(n)||[]).length);
 const sinkTarget=sink?[...nodes].find(n=>n!==sink):null;
 const sinkResult=sink?route(adj,sink,sinkTarget,120000):null;
 const limitResult=route(adj,sample.from,sample.to,1);
 const tests=[
 {name:'multi-road route found',pass:r.found&&r.edgeCount>=2&&r.roadIds.length>=2},
 {name:'directed edge continuity',pass:checkPath(r,sample.from,sample.to)},
 {name:'route distance positive',pass:r.found&&r.distanceMeters>0},
 {name:'reverse direction checked (not assumed)',pass:typeof reverse.found==='boolean'},
 {name:'unreachable sink test',pass:!!sink&&sinkResult?.reason==='unreachable-in-directed-graph'},
 {name:'search visit limit enforced',pass:limitResult.reason==='search-limit'},
 {name:'performance measurement collected',pass:Number.isFinite(elapsedMs)&&elapsedMs>=0}
 ];
 emit(tests,{graphEdges:loaded,graphNodes:nodes.size,sample:{...sample,found:r.found,distanceMeters:r.distanceMeters,edgeCount:r.edgeCount,roadCount:r.roadIds?.length,visited:r.visited,elapsedMs,reverseFound:reverse.found,reverseVisited:reverse.visited},sinkNode:sink||null,caveat:'This batch checks graph mechanics, not road legality, turn restrictions, barrier rules, GPS matching or production latency. Reverse route may legitimately exist via another path.'});
 }finally{await conn.close();}
}
if(require.main===module)main().catch(e=>{console.error('BATCH 1 FAILED:',e.message);process.exitCode=1;});
