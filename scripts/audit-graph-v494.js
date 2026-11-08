'use strict';
// Jalan V4.9.4: read-only OSM-node connectivity audit. No writes or routing changes.
require('dotenv').config();
const mongoose = require('mongoose');
const DB='jalan_navigation';
const ROAD='road_network_v493';
const RESTR='road_turn_restrictions_v493';
const QUAR='road_restriction_quarantine_v493';
async function main(){
 if(!process.env.MTERM2026_DB_URI) throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:15000,autoIndex:false}).asPromise();
 try {
  if(conn.name!==DB) throw Error('Database mismatch');
  const db=conn.db;
  const [roadCount,restrictionCount,quarantineCount]=await Promise.all([db.collection(ROAD).countDocuments(),db.collection(RESTR).countDocuments(),db.collection(QUAR).countDocuments()]);
  if(roadCount!==31525||restrictionCount!==1941||quarantineCount!==45)throw Error(`Unexpected collection counts ${roadCount}/${restrictionCount}/${quarantineCount}; audit stopped`);
  const junctions=new Map(),adj=new Map(),ways=new Set();
  const counts={roads:0,segments:0,forwardArcs:0,reverseArcs:0,roadsWithoutNodes:0,roadsWithRepeatedNodes:0,onewayRoads:0,reverseOnewayRoads:0,nonMotorAccessTagged:0,bridgeTagged:0,tunnelTagged:0,gradeConflictAtSharedNode:0};
  const flagged=[];
  function add(a,b){if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}
  const cursor=db.collection(ROAD).find({}, {projection:{roadId:1,nodeIds:1,oneway:1,onewayDirection:1,bridge:1,tunnel:1,layer:1,access:1,motorVehicle:1,vehicle:1,geometry:1}}).batchSize(250);
  for await(const r of cursor){
   counts.roads++;ways.add(r.roadId);
   const ns=r.nodeIds||[];
   if(ns.length<2||ns.length!==r.geometry?.coordinates?.length){counts.roadsWithoutNodes++;continue;}
   if(new Set(ns).size!==ns.length)counts.roadsWithRepeatedNodes++;
   if(r.bridge && r.bridge!=='no')counts.bridgeTagged++;
   if(r.tunnel && r.tunnel!=='no')counts.tunnelTagged++;
   if(['no','private'].includes(r.access)||['no','private'].includes(r.motorVehicle)||['no','private'].includes(r.vehicle))counts.nonMotorAccessTagged++;
   const dir=String(r.onewayDirection||'').toLowerCase();
   const reverse=dir==='-1'||dir==='reverse'||dir==='backward';
   const one=Boolean(r.oneway)||reverse;
   if(one)counts.onewayRoads++;
   if(reverse)counts.reverseOnewayRoads++;
   for(const n of ns){if(!junctions.has(n))junctions.set(n,[]);junctions.get(n).push({way:r.roadId,layer:r.layer,bridge:r.bridge,tunnel:r.tunnel});}
   for(let i=1;i<ns.length;i++){
    const a=ns[i-1],b=ns[i];if(a===b)continue;
    counts.segments++;
    if(!one||!reverse){add(a,b);counts.forwardArcs++;}
    if(!one||reverse){add(b,a);counts.reverseArcs++;}
   }
  }
  let sharedNodes=0,multiwayNodes=0,deadEndNodes=0,isolatedNodes=0,gradeConflicts=0;
  for(const [n,items] of junctions){
   const distinct=[...new Set(items.map(x=>x.way))];
   if(distinct.length>1){sharedNodes++;if(distinct.length>2)multiwayNodes++;
    const levels=new Set(items.map(x=>`${x.layer??'unset'}|${x.bridge||''}|${x.tunnel||''}`));
    if(levels.size>1){gradeConflicts++;if(flagged.length<10)flagged.push({nodeId:n,ways:distinct.slice(0,6),gradeSignatures:[...levels].slice(0,6)});}
   }
   const degree=adj.get(n)?.size||0;if(degree===0)isolatedNodes++;else if(degree===1)deadEndNodes++;
  }
  const missingRestrictionWays=new Set();let conditional=0,viaWay=0;
  for await(const r of db.collection(RESTR).find({},{projection:{fromWay:1,toWay:1,viaWays:1,conditional:1}})){
   for(const id of [r.fromWay,r.toWay,...(r.viaWays||[])])if(id&&!ways.has(id))missingRestrictionWays.add(id);
   if(r.conditional)conditional++;if(r.viaWays?.length)viaWay++;
  }
  const roadIndexes=await db.collection(ROAD).indexes();
  const report={ok:true,mode:'GRAPH_AUDIT_V494',readOnly:true,databaseWrites:0,graphPersisted:false,routingEnforced:false,counts:{...counts,uniqueNodeIds:junctions.size,sharedNodes,multiwayNodes,deadEndNodes,isolatedNodes,gradeConflicts,restrictionCount,quarantineCount,conditionalRestrictionRecords:conditional,viaWayRestrictionRecords:viaWay,missingRestrictionWayReferences:missingRestrictionWays.size},indexes:roadIndexes.map(i=>({name:i.name,key:i.key,unique:!!i.unique})),samples:{gradeConflicts:flagged,missingRestrictionWays:[...missingRestrictionWays].slice(0,10)},caveats:['Shared OSM node IDs indicate candidate topology, not verified legal motor-vehicle routing.','Access, barrier, ford, turn restrictions, conditional rules, and turn geometry are not enforced.','Bridge/layer discrepancies are diagnostic; shared node IDs may still be connected.','Directed arcs are based on stored onewayDirection values; verify source semantics before routing.','No graph or indexes are created by this audit.']};
  console.log(JSON.stringify(report,null,2));
 } finally {await conn.close();}
}
main().catch(e=>{console.error('GRAPH AUDIT FAILED:',e.message);process.exitCode=1;});
