'use strict';
// Jalan Batch 2B — via-way turn restriction prototype and coverage audit.
// Read-only. No legal-driving-route guarantee.
require('dotenv').config();
const mongoose=require('mongoose');
const {indexRestrictions,permitted}=require('./test-jalan-batch2-implementation');
const DB='jalan_navigation', RESTR='road_turn_restrictions_v493', EDGES='road_graph_edges_v495', QUAR='road_restriction_quarantine_v493';
const args=process.argv.slice(2);
if(args.some(x=>x!=='--self-test')){console.error('Usage: node scripts/test-jalan-batch2b.js [--self-test]');process.exit(1);}
const s=x=>String(x??'');
function classify(r){
 const type=s(r.restriction).toLowerCase(), viaNodes=r.viaNodes||[], viaWays=r.viaWays||[];
 if(r.conditional)return 'conditional-deferred';
 if(!r.fromWay||!r.toWay||(!type.startsWith('no_')&&!type.startsWith('only_')))return 'unsupported-type';
 if(viaWays.length){
  if(viaNodes.length)return 'mixed-via-deferred';
  if(type.startsWith('only_'))return 'only-via-way-deferred';
  if(viaWays.some(x=>!x)||new Set(viaWays).size!==viaWays.length)return 'invalid-via-way';
  return 'no-via-way-candidate';
 }
 if(viaNodes.length===1)return 'via-node-supported';
 return 'unsupported-via';
}
// A path history is tracked as the most recent sequence of road IDs, compressed
// to changes of road. A forbidden sequence is [fromWay, ...viaWays, toWay].
// Matching must be checked at the transition to toWay, not on the via road itself.
function sequence(r){return [s(r.fromWay),...(r.viaWays||[]).map(s),s(r.toWay)];}
function updateHistory(history,nextRoad,maxLength){
 const h=history.slice();if(h[h.length-1]!==nextRoad)h.push(nextRoad);
 return h.slice(-maxLength);
}
function createMatcher(records){
 const rules=records.filter(r=>classify(r)==='no-via-way-candidate').map(r=>({id:s(r.restrictionId),sequence:sequence(r)}));
 const maxLength=Math.max(2,...rules.map(r=>r.sequence.length));
 function step(history,nextRoad){
  const next=updateHistory(history,s(nextRoad),maxLength);
  const blockedBy=rules.filter(r=>r.sequence.every((road,i)=>next[next.length-r.sequence.length+i]===road));
  return {history:next,blocked:blockedBy.length>0,blockedBy:blockedBy.map(x=>x.id)};
 }
 return {rules,maxLength,step};
}
function simulate(roads,matcher){let history=[],blockedAt=-1,blockedBy=[];for(let i=0;i<roads.length;i++){const result=matcher.step(history,roads[i]);history=result.history;if(result.blocked){blockedAt=i;blockedBy=result.blockedBy;break;}}return {blocked:blockedAt>=0,blockedAt,blockedBy};}
function report(mode,checks,extra){const passed=checks.filter(x=>x.pass).length;console.log(JSON.stringify({ok:passed===checks.length,mode,passed,total:checks.length,tests:checks,...extra,databaseWrites:0,routingActivated:false,legalDrivingRouteVerified:false},null,2));if(passed!==checks.length)process.exitCode=2;}
function selfTest(){
 const no={restrictionId:'r1',restriction:'no_left_turn',fromWay:'A',viaWays:['B'],viaNodes:[],toWay:'C'};
 const two={restrictionId:'r2',restriction:'no_right_turn',fromWay:'P',viaWays:['Q','R'],viaNodes:[],toWay:'S'};
 const only={restrictionId:'r3',restriction:'only_straight_on',fromWay:'X',viaWays:['Y'],viaNodes:[],toWay:'Z'};
 const cond={...no,restrictionId:'r4',conditional:'Mo-Fr 07:00-09:00'};
 const matcher=createMatcher([no,two,only,cond]);
 const checks=[
  {name:'single via-way forbidden transition blocked',pass:simulate(['A','B','C'],matcher).blocked},
  {name:'entry into via way alone is allowed',pass:!simulate(['A','B'],matcher).blocked},
  {name:'alternative exit remains allowed',pass:!simulate(['A','B','D'],matcher).blocked},
  {name:'unrelated entry remains allowed',pass:!simulate(['D','B','C'],matcher).blocked},
  {name:'repeated segments on via road retained',pass:!simulate(['A','B','B'],matcher).blocked&&simulate(['A','B','B','C'],matcher).blocked},
  {name:'multi via-way sequence blocked',pass:simulate(['P','Q','R','S'],matcher).blocked},
  {name:'multi via-way wrong order allowed',pass:!simulate(['P','R','Q','S'],matcher).blocked},
  {name:'only via-way deliberately deferred',pass:classify(only)==='only-via-way-deferred'},
  {name:'conditional restriction deliberately deferred',pass:classify(cond)==='conditional-deferred'},
  {name:'via-node restrictions remain supported separately',pass:classify({restriction:'no_left_turn',fromWay:'A',toWay:'B',viaNodes:['n'],viaWays:[]})==='via-node-supported'},
  {name:'state history distinguishes paths at same node',pass:matcher.step(['A','B'],'C').blocked&&!matcher.step(['D','B'],'C').blocked},
  {name:'matcher does not alter input',pass:no.viaWays.join(',')==='B'&&matcher.rules.length===2}
 ];
 report('BATCH2B_SYNTHETIC',checks,{syntheticOnly:true,scope:'via-way no_ sequence matcher prototype; not connected to production Dijkstra'});
}
async function database(){
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try{
  if(conn.name!==DB)throw Error('Database mismatch');const db=conn.db;
  const [edgeCount,restrictionCount,quarantineCount]=await Promise.all([db.collection(EDGES).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
  if(edgeCount!==168221||restrictionCount!==1941||quarantineCount!==45)throw Error('Source counts changed; audit aborted');
  const records=await db.collection(RESTR).find({}).toArray();const counts={};for(const r of records){const k=classify(r);counts[k]=(counts[k]||0)+1;}
  const viaWay=records.filter(r=>(r.viaWays||[]).length>0);
  const referencedWays=new Set();for(const r of records){for(const w of [r.fromWay,r.toWay,...(r.viaWays||[])])if(w)referencedWays.add(w);}
  const roadWayIds=new Set();for await(const r of db.collection('road_network_v493').find({},{projection:{roadId:1}}).batchSize(1000))roadWayIds.add(r.roadId);
  const missingWays=[...referencedWays].filter(w=>!roadWayIds.has(w));
  const matcher=createMatcher(records), examples=matcher.rules.slice(0,3).map(r=>({restrictionId:r.id,roadSequence:r.sequence}));
  const checks=[
   {name:'graph edge count unchanged',pass:edgeCount===168221},
   {name:'restriction records unchanged',pass:records.length===1941},
   {name:'quarantine unchanged',pass:quarantineCount===45},
   {name:'all restrictions classified',pass:Object.values(counts).reduce((a,b)=>a+b,0)===1941},
   {name:'via-way records detected',pass:viaWay.length===715},
   {name:'no missing restriction way references',pass:missingWays.length===0},
   {name:'supported via-node count preserved',pass:indexRestrictions(records).supported===1225},
   {name:'candidate rules generated without writes',pass:matcher.rules.length===(counts['no-via-way-candidate']||0)}
  ];
  report('BATCH2B_DATABASE_AUDIT',checks,{database:DB,counts:{edges:edgeCount,restrictions:restrictionCount,quarantine:quarantineCount,viaWay:viaWay.length},classification:counts,viaWayCandidateCount:matcher.rules.length,missingWayReferences:missingWays.slice(0,10),sampleCandidateSequences:examples,caveats:['Only no_ via-way restrictions are candidate rules; only_ via-way and conditional restrictions are deferred.','The matcher is a synthetic road-sequence prototype, not integrated into the real routing engine.','Sequence-only matching may not capture all OSM relation entry/exit semantics, repeated-way paths or intersection topology.','Barriers, access schedules and full legal driving validity remain unverified.']});
 }finally{await conn.close();}
}
if(require.main===module)(args.includes('--self-test')?Promise.resolve().then(selfTest):database()).catch(e=>{console.error('BATCH2B FAILED:',e.message);process.exitCode=1;});
module.exports={classify,sequence,createMatcher,simulate};
