'use strict';
// Jalan Batch 2C: read-only real graph restriction validation. Never activates routing.
require('dotenv').config();
const mongoose = require('mongoose');
const DB='jalan_navigation', EDGE='road_graph_edges_v495', RESTR='road_turn_restrictions_v493', QUAR='road_restriction_quarantine_v493';
const assert=require('assert');
const isNo=r=>String(r.restriction||'').startsWith('no_');
const isOnly=r=>String(r.restriction||'').startsWith('only_');
const key=(a,b)=>`${a}\u0000${b}`;
function makeRules(restrictions){
 const at=new Map();
 for(const r of restrictions){
  if(r.conditional||r.viaWays?.length||r.viaNodes?.length!==1||!r.fromWay||!r.toWay||(!isNo(r)&&!isOnly(r)))continue;
  const k=key(String(r.viaNodes[0]),String(r.fromWay));
  if(!at.has(k))at.set(k,{no:new Set(),only:new Set()});
  at.get(k)[isNo(r)?'no':'only'].add(String(r.toWay));
 }
 return at;
}
function allowed(rules,node,fromWay,toWay){
 const r=rules.get(key(node,fromWay));
 return !r||(!r.no.has(toWay)&&(!r.only.size||r.only.has(toWay)));
}
function makeAdj(edges){const a=new Map();for(const e of edges){if(!a.has(e.fromNode))a.set(e.fromNode,[]);a.get(e.fromNode).push(e);}return a;}
function route(adj,start,end,rules,maxVisits=150000){
 // State includes incoming road to apply via-node restrictions. BFS diagnostic, not distance-optimal.
 const q=[{node:start,road:null,parent:-1,edge:null}], seen=new Set([key(start,'')]);let endIndex=-1;
 for(let i=0;i<q.length&&i<maxVisits;i++){
  const s=q[i];if(s.node===end){endIndex=i;break;}
  for(const e of adj.get(s.node)||[]){if(s.road&&!allowed(rules,s.node,s.road,e.roadId))continue;
   const k=key(e.toNode,e.roadId);if(seen.has(k))continue;seen.add(k);q.push({node:e.toNode,road:e.roadId,parent:i,edge:e});}
 }
 if(endIndex<0)return {found:false,visited:Math.min(q.length,maxVisits),edges:[]};
 const result=[];for(let i=endIndex;q[i].parent>=0;i=q[i].parent)result.push(q[i].edge);result.reverse();
 return {found:true,visited:endIndex+1,edges:result};
}
function viaWayTopology(r,byWay){
 // Candidate topology ONLY: existence of directed entry and exit node on via way.
 // Does not prove a legal traversal or enforce relation member order.
 const via=(r.viaWays||[]).map(String);if(!via.length||!r.fromWay||!r.toWay)return {candidate:false,reason:'missing-members'};
 const from=byWay.get(String(r.fromWay))||[],to=byWay.get(String(r.toWay))||[];
 const viaEdges=via.map(w=>byWay.get(w)||[]);
 if(!from.length||!to.length||viaEdges.some(a=>!a.length))return {candidate:false,reason:'missing-graph-way'};
 let entries=new Set(from.map(e=>e.toNode));
 for(const group of viaEdges){
  const next=new Set(),out=new Map();for(const e of group){if(!out.has(e.fromNode))out.set(e.fromNode,[]);out.get(e.fromNode).push(e.toNode);}
  const queue=[...entries],seen=new Set(queue);for(let i=0;i<queue.length;i++)for(const v of out.get(queue[i])||[])if(!seen.has(v)){seen.add(v);queue.push(v);}
  // Must travel at least one directed edge on this via-way, not merely touch it.
  for(const e of group)if(seen.has(e.fromNode))next.add(e.toNode);
  if(!next.size)return {candidate:false,reason:'no-directed-via-traversal'};
  entries=next;
 }
 const exits=new Set(to.map(e=>e.fromNode));return {candidate:[...entries].some(n=>exits.has(n)),reason:'directed-sequence-check'};
}
function selfTest(){
 const E=(fromNode,toNode,roadId)=>({fromNode,toNode,roadId});
 const es=[E('a','b','A'),E('b','c','B'),E('b','d','C'),E('d','c','D')];const adj=makeAdj(es);
 const no=makeRules([{restriction:'no_left_turn',fromWay:'A',toWay:'B',viaNodes:['b']}]);
 const only=makeRules([{restriction:'only_right_turn',fromWay:'A',toWay:'C',viaNodes:['b']}]);
 const tests=[
 ['unrestricted path',route(adj,'a','c',new Map()).found],
 ['no-turn blocks transition',!allowed(no,'b','A','B')],
 ['no-turn preserves alternative',route(adj,'a','c',no).edges.map(e=>e.roadId).join(',')==='A,C,D'],
 ['only-turn blocks other exits',!allowed(only,'b','A','B')],
 ['only-turn allows specified exit',allowed(only,'b','A','C')],
 ['via-node applies at correct node',allowed(no,'x','A','B')],
 ['unreachable detected',!route(adj,'c','a',no).found],
 ['via-way directed topology candidate',viaWayTopology({fromWay:'A',viaWays:['C'],toWay:'D'},new Map([['A',[es[0]]],['C',[es[2]]],['D',[es[3]]]])).candidate],
 ['via-way disconnected rejected',!viaWayTopology({fromWay:'A',viaWays:['D'],toWay:'C'},new Map([['A',[es[0]]],['D',[es[3]]],['C',[es[2]]]])).candidate],
 ['conditional not enforced',makeRules([{restriction:'no_left_turn',fromWay:'A',toWay:'B',viaNodes:['b'],conditional:'Mo-Fr'}]).size===0]
 ];console.log(JSON.stringify({ok:tests.every(t=>t[1]),mode:'BATCH2C_SELF_TEST',passed:tests.filter(t=>t[1]).length,total:tests.length,tests:tests.map(([name,pass])=>({name,pass:!!pass})),databaseWrites:0},null,2));if(tests.some(t=>!t[1]))process.exitCode=1;
}
async function database(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
  if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;
  const [edgeCount,restrictionCount,quarantineCount]=await Promise.all([db.collection(EDGE).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
  if(edgeCount!==168221||restrictionCount!==1941||quarantineCount!==45)throw Error(`Unexpected source counts ${edgeCount}/${restrictionCount}/${quarantineCount}`);
  const [edges,restrictions]=await Promise.all([db.collection(EDGE).find({},{projection:{_id:0,edgeId:1,fromNode:1,toNode:1,roadId:1}}).toArray(),db.collection(RESTR).find({},{projection:{_id:0,restrictionId:1,restriction:1,conditional:1,fromWay:1,toWay:1,viaNodes:1,viaWays:1}}).toArray()]);
  const adj=makeAdj(edges),byWay=new Map();for(const e of edges){if(!byWay.has(e.roadId))byWay.set(e.roadId,[]);byWay.get(e.roadId).push(e);}
  const rules=makeRules(restrictions);
  const via=restrictions.filter(r=>r.viaWays?.length),candidates=via.filter(r=>isNo(r)&&!r.conditional);
  const topology={candidate:0,notConnected:0,missingGraphWay:0,examples:[]};
  for(const r of candidates){const v=viaWayTopology(r,byWay);if(v.candidate)topology.candidate++;else{topology.notConnected++;if(v.reason==='missing-graph-way')topology.missingGraphWay++;}if(topology.examples.length<5)topology.examples.push({restrictionId:r.restrictionId,topologyCandidate:v.candidate,reason:v.reason});}
  // Select a real restriction with reachable incoming and outgoing edges and compare routing on a small local trip.
  let sample=null;
  for(const r of restrictions){if(r.viaWays?.length||r.viaNodes?.length!==1||!isNo(r)||r.conditional)continue;
   const via=String(r.viaNodes[0]),incoming=(byWay.get(r.fromWay)||[]).find(e=>e.toNode===via),outgoing=(byWay.get(r.toWay)||[]).find(e=>e.fromNode===via);
   if(!incoming||!outgoing)continue;
   const unrestricted=route(adj,incoming.fromNode,outgoing.toNode,new Map(),50000);
   const restricted=route(adj,incoming.fromNode,outgoing.toNode,rules,50000);
   sample={restrictionId:r.restrictionId,fromNode:incoming.fromNode,viaNode:via,toNode:outgoing.toNode,unrestrictedFound:unrestricted.found,restrictedFound:restricted.found,unrestrictedEdges:unrestricted.edges.length,restrictedEdges:restricted.edges.length,restrictedVisited:restricted.visited,restrictedUsesProhibitedTransition:restricted.edges.some((e,i,a)=>i>0&&a[i-1].roadId===r.fromWay&&e.roadId===r.toWay&&e.fromNode===via)};break;
  }
  const checks=[['graph count',edgeCount===168221],['restriction count',restrictionCount===1941],['quarantine count',quarantineCount===45],['via-node rules compiled',rules.size>0],['via-way records classified',via.length>0],['directed via-way topology checked',topology.candidate+topology.notConnected===candidates.length],['real restriction route sample found',!!sample],['sample does not use prohibited transition',!!sample&&!sample.restrictedUsesProhibitedTransition]];
  const result={ok:checks.every(t=>t[1]),mode:'BATCH2C_DATABASE',passed:checks.filter(t=>t[1]).length,total:checks.length,tests:checks.map(([name,pass])=>({name,pass:!!pass})),counts:{edges:edgeCount,restrictions:restrictionCount,quarantine:quarantineCount},viaNodeRuleKeys:rules.size,viaWay:{total:via.length,noCandidates:candidates.length,...topology},realRouteSample:sample,databaseWrites:0,routingActivated:false,legalDrivingRouteVerified:false,caveats:['Via-way topology checks are diagnostic only, not enforced during route search.','BFS is not distance-optimal and is not production routing.','Simple via-node restrictions only; conditional rules, barriers and complete access policy remain unsupported.','A single sampled real route does not establish citywide legal route correctness.']};
  console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
 }finally{await conn.close();}
}
if(require.main===module)(process.argv.includes('--self-test')?Promise.resolve().then(selfTest):database()).catch(e=>{console.error('BATCH2C FAILED:',e.stack||e.message);process.exitCode=1});
module.exports={makeRules,allowed,makeAdj,route,viaWayTopology};
