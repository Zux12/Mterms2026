'use strict';
// Read-only Atlas full-import turn readiness preflight. No route activation.
// Invoke in isolated CI with JALAN_READONLY_MONGODB_URI repository secret.
const mongoose=require('mongoose');
const {classifyTurnEnforcement}=require('./kl-turn-enforcement-readiness-v4102');
const {searchTurnAware}=require('./kl-turn-aware-search-v4102');
async function main(){
 if(!process.env.JALAN_READONLY_MONGODB_URI)throw Error('Read-only URI not configured');
 try{
  await mongoose.connect(process.env.JALAN_READONLY_MONGODB_URI,{
   serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'
  });
  const db=mongoose.connection.useDb('jalan_navigation',{useCache:true}).db;
  const edges=await db.collection('road_graph_edges_v495').countDocuments();
  if(edges!==168221)throw Error('Graph edge count changed');
  const col=db.collection('road_turn_restrictions_v493');
  const count=await col.countDocuments();
  if(count<1||count>5000)throw Error('Unexpected turn relation count');
  const rows=await col.find({},{projection:{_id:0,restrictionId:1,fromWay:1,
   toWay:1,viaNodes:1,viaWays:1,restriction:1,applicability:1,
   conditional:1,except:1}}).toArray();
  if(rows.length!==count)throw Error('Turn collection changed during read');
  const r=classifyTurnEnforcement(rows);
  if(r.counts.total!==count)throw Error('Classification mismatch');
  if(r.allRestrictionsReady||r.turnRestrictionsEnforced!==false||
    r.productionRoutingAuthorized!==false)
   throw Error('Unexpected turn enforcement activation');
  // Real imported restriction collection is passed to the separate turn-aware
  // prototype. It MUST fail closed before traversing even an available graph.
  // This is a full-import safety gate, NOT a successful turn-aware route.
  const guard=searchTurnAware({adj:new Map()},'5738558701','10800536675',rows);
  if(guard.ok!==false||guard.reason!=='turn-restrictions-not-fully-verified'||
     guard.productionRoutingAuthorized!==false||guard.eligibleCount!==0)
   throw Error('Turn-aware full-import fail-closed gate violated');
  console.log(JSON.stringify({mode:'READ_ONLY_TURN_READINESS',
   graphEdges:edges,turnRelations:count,classification:r.counts,independentFlags:r.independentFlags,
   fullImportTurnAwareGuard:'blocked-unverified-restrictions',
   allRestrictionsReady:false,turnRestrictionsEnforced:false,
   productionRoutingAuthorized:false},null,2));
 }finally{await mongoose.disconnect();}
}
if(require.main===module)main().catch(e=>{
 // Avoid printing database URI, credentials, server errors, or raw records.
 process.stderr.write('Turn readiness preflight failed (details suppressed).\n');
 process.exitCode=1;
});
