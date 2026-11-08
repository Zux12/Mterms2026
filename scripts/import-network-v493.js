'use strict';
// Dry run by default. This importer never modifies V4.9.0/V4.9.1, pilot, MTerms or traffic.
require('dotenv').config();
const fs=require('fs'),path=require('path'),crypto=require('crypto'),mongoose=require('mongoose');
const {build}=require('./import-network-v491');
const {models,DB,COLLECTION,RESTRICTIONS,QUARANTINE}=require('../server/jalan/network-v493');
const EXPECTED_SHA='39322dfa5ba88269a83c3f641fd2dc10672d7e9adf1b10a9ef00965f98138057';
const args=process.argv.slice(2),write=args.includes('--write'),files=args.filter(x=>!x.startsWith('--'));
if(files.length!==1||args.some(x=>x.startsWith('--')&&x!=='--write')){console.error('Usage: node scripts/import-network-v493.js export-2.json [--write]');process.exit(1);}
const str=v=>String(v??'');
function classify(input,roads,restrictions){
 const wayIds=new Set(roads.map(r=>r.roadId)), nodeIds=new Set(input.elements.filter(e=>e.type==='node').map(e=>str(e.id)));
 const validIds=new Set(restrictions.map(r=>r.restrictionId));
 const quarantine=[];
 for(const e of input.elements){
  if(e.type!=='relation'||e.tags?.type!=='restriction')continue;
  const id='osm-relation-'+e.id;if(validIds.has(id))continue;
  const members=Array.isArray(e.members)?e.members:[];
  const from=members.filter(m=>m.role==='from'&&m.type==='way');const to=members.filter(m=>m.role==='to'&&m.type==='way');
  const via=members.filter(m=>m.role==='via'&&(m.type==='way'||m.type==='node'));
  const reasons=[],missing=[];
  if(from.length!==1||to.length!==1||!via.length)reasons.push('invalid-structure');
  for(const m of [...from,...to,...via]){
   if(m.type==='way'&&!wayIds.has('osm-way-'+m.ref))missing.push(`${m.role}:way:${m.ref}`);
   if(m.type==='node'&&!nodeIds.has(str(m.ref)))missing.push(`${m.role}:node:${m.ref}`);
  }
  if(missing.length)reasons.push('unresolved-reference');
  if(!reasons.length)reasons.push('unsupported-relation');
  quarantine.push({restrictionId:id,reasons,missing,memberRoles:members.map(m=>`${m.role}:${m.type}`),tags:e.tags||{},members});
 }
 return quarantine;
}
async function main(){
 const bytes=fs.readFileSync(path.resolve(files[0]));const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 const input=JSON.parse(bytes.toString('utf8'));const parsed=build(input);
 const quarantine=classify(input,parsed.roads,parsed.restrictions);
 const sourceVersion=str(input.osm3s?.timestamp_osm_base||'unversioned');
 const conditional=parsed.restrictions.filter(r=>r.conditional);
 const integrity={roads:parsed.roads.length,restrictions:parsed.restrictions.length,quarantine:quarantine.length,missingNodes:parsed.stats.missingNodes,invalidRoads:parsed.stats.invalid,outOfBounds:parsed.stats.outOfBounds,duplicateRoads:parsed.stats.duplicateRoads,unhandledConditionalRestrictions:parsed.stats.unhandledConditionalRestrictions};
 const expectedCounts=integrity.roads===31525&&integrity.restrictions===1941&&integrity.quarantine===45&&integrity.missingNodes===0&&integrity.invalidRoads===0&&integrity.outOfBounds===0&&integrity.duplicateRoads===0;
 const sourceMatches=sha256===EXPECTED_SHA;
 const ready=expectedCounts&&sourceMatches&&parsed.roads.every(r=>r.nodeIds.length===r.geometry.coordinates.length);
 console.log(JSON.stringify({ok:ready,mode:write?'WRITE_REQUESTED':'DRY_RUN',database:DB,collections:[COLLECTION,RESTRICTIONS,QUARANTINE],sourceVersion,sha256,sourceMatches,integrity,conditionalRestrictionIds:conditional.map(r=>r.restrictionId),quarantineReasons:quarantine.reduce((a,r)=>(r.reasons.forEach(k=>a[k]=(a[k]||0)+1),a),{}),sampleQuarantine:quarantine.slice(0,5).map(r=>({restrictionId:r.restrictionId,reasons:r.reasons,missing:r.missing})),readyForGuardedImport:ready,graphBuilt:false,routingEnforced:false,databaseWrites:0},null,2));
 if(!write){console.log('DRY RUN: no database connection or writes.');return;}
 if(!ready)throw Error('Write blocked: source checksum or validated counts differ');
 if(process.env.JALAN_V493_IMPORT_CONFIRM!==`${DB}.${COLLECTION}`)throw Error('Write blocked: JALAN_V493_IMPORT_CONFIRM does not match target');
 if(process.env.JALAN_V493_SOURCE_SHA256!==EXPECTED_SHA)throw Error('Write blocked: JALAN_V493_SOURCE_SHA256 confirmation missing/mismatched');
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:10000}).asPromise();
 try{
  if(conn.name!==DB)throw Error('Database mismatch');
  const {Road,Restriction,Quarantine}=models(conn);
  for(const m of [Road,Restriction,Quarantine])await m.init();
  const importedAt=new Date();
  async function upsert(Model,docs,key){let matched=0,upserted=0,modified=0;for(let i=0;i<docs.length;i+=200){const ops=docs.slice(i,i+200).map(d=>({updateOne:{filter:{[key]:d[key]},update:{$set:{...d,sourceVersion,importedAt}},upsert:true}}));const r=await Model.bulkWrite(ops,{ordered:false});matched+=r.matchedCount;upserted+=r.upsertedCount;modified+=r.modifiedCount;}return {matched,upserted,modified};}
  const roadResult=await upsert(Road,parsed.roads,'roadId');
  const restrictionResult=await upsert(Restriction,parsed.restrictions,'restrictionId');
  const quarantineResult=await upsert(Quarantine,quarantine,'restrictionId');
  const [roadCount,restrictionCount,quarantineCount]=await Promise.all([Road.countDocuments(),Restriction.countDocuments(),Quarantine.countDocuments()]);
  const exact=roadCount===31525&&restrictionCount===1941&&quarantineCount===45;
  console.log(JSON.stringify({ok:exact,mode:'WRITE_COMPLETE',sourceVersion,sha256,roadResult,restrictionResult,quarantineResult,roadCount,restrictionCount,quarantineCount,exactCounts:exact,graphBuilt:false,routingEnforced:false,note:'No deletion; preexisting records could cause count mismatch. Do not use for live routing.'},null,2));
  if(!exact)process.exitCode=2;
 }finally{await conn.close();}
}
if(require.main===module)main().catch(e=>{console.error('Import failed:',e.message);process.exitCode=1;});
module.exports={classify,main};
