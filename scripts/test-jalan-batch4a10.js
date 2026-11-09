'use strict';
// Read-only Batch 4A.10: verify four persistent OSM extracts; report duplicates and relation completeness.
// No database connection or writes. Never modifies the extracts.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {TILES,validate}=require('./prepare-jalan-batch4a9');
const names=Object.keys(TILES);
function inspect(doc,tile){
 const counts=validate(doc),byType=new Map(),duplicateWithin=[],idSet=new Set();
 for(const e of doc.elements){
  const k=e.type+':'+e.id;
  if(idSet.has(k))duplicateWithin.push(k);
  idSet.add(k);byType.set(k,e);
 }
 const relations=doc.elements.filter(e=>e.type==='relation'&&e.tags?.type==='restriction');
 let missingMembers=0,viaNode=0,viaWay=0,conditional=0;
 const missingSamples=[];
 for(const r of relations){
  if(r.tags?.['restriction:conditional'])conditional++;
  if((r.members||[]).some(m=>m.role==='via'&&m.type==='node'))viaNode++;
  if((r.members||[]).some(m=>m.role==='via'&&m.type==='way'))viaWay++;
  for(const m of r.members||[]){
   if(!byType.has(m.type+':'+m.ref)){missingMembers++;if(missingSamples.length<12)missingSamples.push({relation:r.id,member:m.type+':'+m.ref,role:m.role});}
  }
 }
 return {tile,counts,duplicateWithin:duplicateWithin.slice(0,10),duplicateWithinCount:duplicateWithin.length,restrictions:{total:relations.length,viaNode,viaWay,conditional,missingMembers,missingSamples},byType};
}
function audit(dir){
 const reports=[],all=new Map(),crossDuplicates=new Set(),conflicts=[];
 for(const tile of names){
  const file=path.join(dir,tile+'.osm.json');
  if(!fs.existsSync(file))throw Error('Missing '+file+' — download on your computer; do not rely on Heroku /tmp');
  const raw=fs.readFileSync(file),doc=JSON.parse(raw.toString('utf8')),one=inspect(doc,tile);
  const digest=crypto.createHash('sha256').update(raw).digest('hex');
  for(const e of doc.elements){
   const k=e.type+':'+e.id,previous=all.get(k);
   if(previous){
    crossDuplicates.add(k);
    // Same element can be revised between Overpass requests; flag version mismatches.
    if(previous.version!==undefined&&e.version!==undefined&&previous.version!==e.version&&conflicts.length<30)conflicts.push({id:k,versions:[previous.version,e.version],tiles:[previous.tile,tile]});
   }else all.set(k,{version:e.version,tile});
  }
  reports.push({tile,bytes:raw.length,sha256:digest,counts:one.counts,duplicateWithinCount:one.duplicateWithinCount,restrictionAudit:one.restrictions});
 }
 return {ok:true,mode:'BATCH4A10_LOCAL_EXTRACTION_VALIDATION',files:reports,uniqueElements:all.size,crossTileDuplicateElements:crossDuplicates.size,versionConflicts:conflicts,requiresManualReview:conflicts.length>0||reports.some(r=>r.restrictionAudit.missingMembers>0),databaseWrites:0,imported:false,liveRoutingActivated:false,legalDrivingRouteVerified:false,notes:['This is metadata validation, not a graph import or legal route verification.','Overlap duplicates are expected and must be deduplicated before any import.','Missing relation members may require expanded extraction; do not silently discard.','Store four raw JSON files and this report outside ephemeral Heroku storage.']};
}
function selfTest(){const sample={elements:[{type:'node',id:1,lat:3,lon:101},{type:'node',id:2,lat:3.01,lon:101},{type:'way',id:3,nodes:[1,2]},{type:'relation',id:4,tags:{type:'restriction',restriction:'no_right_turn'},members:[{type:'way',ref:3,role:'from'},{type:'node',ref:2,role:'via'},{type:'way',ref:5,role:'to'}]}]};
const a=inspect(sample,'test');const checks=[['four tiles',names.length===4],['node count',a.counts.node===2],['way count',a.counts.way===1],['restriction count',a.counts.restrictions===1],['via node counted',a.restrictions.viaNode===1],['missing relation member detected',a.restrictions.missingMembers===1],['missing member role',a.restrictions.missingSamples[0].role==='to'],['no duplicate in sample',a.duplicateWithinCount===0],['duplicate detection',inspect({...sample,elements:[...sample.elements,sample.elements[0]]},'test').duplicateWithinCount===1],['no database writes',true]];
const passed=checks.filter(x=>x[1]).length;console.log(JSON.stringify({ok:passed===checks.length,mode:'BATCH4A10_SELF_TEST',passed,total:checks.length,checks:checks.map(([name,pass])=>({name,pass})),databaseWrites:0},null,2));if(passed!==checks.length)process.exitCode=1;}
if(require.main===module){try{const args=process.argv.slice(2);if(args.length===1&&args[0]==='--self-test')selfTest();else if(args.length===2&&args[0]==='--audit'){const report=audit(path.resolve(args[1]));const output=path.resolve(args[1],'batch4a10-audit.json');fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({...report,auditFile:output},null,2));}else throw Error('Usage: node scripts/test-jalan-batch4a10.js --self-test OR --audit <persistent-directory>');}catch(e){console.error('BATCH4A10 ERROR:',e.message);process.exitCode=1;}}
module.exports={inspect,audit};
