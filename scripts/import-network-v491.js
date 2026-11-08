'use strict';
// node scripts/import-network-v491.js export-2.json [--write]
// Default dry run. No DB connection unless --write AND explicit confirmation.
require('dotenv').config();
const fs=require('fs'),path=require('path'),crypto=require('crypto'),mongoose=require('mongoose');
const {models,DB,COLLECTION,RESTRICTIONS}=require('../server/jalan/network-v491');
const args=process.argv.slice(2),write=args.includes('--write'),files=args.filter(x=>!x.startsWith('--'));
if(files.length!==1||args.some(x=>x.startsWith('--')&&x!=='--write')){console.error('Usage: node scripts/import-network-v491.js export-2.json [--write]');process.exit(1);}
const allowed=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const bounds={south:1.0,north:6.9,west:99.0,east:104.8};
const str=(v,n=150)=>String(v??'').slice(0,n);
const region=(lon,lat)=>`${Math.floor(lat*10)/10}:${Math.floor(lon*10)/10}`;
const validCoord=(p)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=-180&&p[0]<=180&&p[1]>=-90&&p[1]<=90;
function build(input){
 if(!input||!Array.isArray(input.elements))throw Error('Expected Overpass JSON elements array');
 const nodes=new Map(),roads=new Map(),relations=new Map(),stats={nonRoad:0,invalid:0,missingNodes:0,outOfBounds:0,duplicateRoads:0,invalidRelations:0,unresolvedRestrictions:0,unhandledConditionalRestrictions:0};
 for(const el of input.elements)if(el.type==='node'&&Number.isSafeInteger(el.id)&&validCoord([el.lon,el.lat]))nodes.set(el.id,[el.lon,el.lat]);
 for(const el of input.elements){
  if(el.type!=='way')continue;
  if(!allowed.has(el.tags?.highway)){stats.nonRoad++;continue;}
  if(!Number.isSafeInteger(el.id)||!Array.isArray(el.nodes)||el.nodes.length<2||el.nodes.length>10000||!el.nodes.every(Number.isSafeInteger)){stats.invalid++;continue;}
  const ids=el.nodes.map(String);const coordinates=el.nodes.map(id=>nodes.get(id));
  if(coordinates.some(p=>!p)){stats.missingNodes++;continue;}
  if(coordinates.some(p=>!validCoord(p))){stats.invalid++;continue;}
  const xs=coordinates.map(p=>p[0]),ys=coordinates.map(p=>p[1]),bbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  // Preserve entire selected way; do not silently clip geometry or invent node IDs.
  if(bbox[0]<bounds.west||bbox[2]>bounds.east||bbox[1]<bounds.south||bbox[3]>bounds.north){stats.outOfBounds++;continue;}
  const t=el.tags||{};const reverse=t.oneway==='-1';if(reverse){ids.reverse();coordinates.reverse();}
  const oneway=reverse||['yes','1','true'].includes(t.oneway)||(t.oneway!=='no'&&(t.junction==='roundabout'||['motorway','motorway_link'].includes(t.highway)));
  const layer=t.layer===undefined?null:Number(t.layer);const roadId='osm-way-'+el.id;
  if(roads.has(roadId))stats.duplicateRoads++;
  roads.set(roadId,{roadId,name:str(t.name,200),highway:str(t.highway),oneway,onewayDirection:reverse?'reversed':oneway?'forward':'both',maxspeed:str(t.maxspeed,60),nodeIds:ids,bridge:str(t.bridge),tunnel:str(t.tunnel),layer:Number.isFinite(layer)?layer:null,access:str(t.access),motorVehicle:str(t.motor_vehicle),vehicle:str(t.vehicle),junction:str(t.junction),geometry:{type:'LineString',coordinates},bbox,regionKey:region((bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2),tags:{oneway:str(t.oneway),surface:str(t.surface),motorcar:str(t.motorcar),motor_vehicle:str(t.motor_vehicle),access:str(t.access),service:str(t.service),lanes:str(t.lanes),maxheight:str(t.maxheight),maxweight:str(t.maxweight)}});
 }
 for(const el of input.elements){
  if(el.type!=='relation'||el.tags?.type!=='restriction')continue;
  if(!Number.isSafeInteger(el.id)||!Array.isArray(el.members)){stats.invalidRelations++;continue;}
  const m=el.members,from=m.filter(x=>x.role==='from'&&x.type==='way'),to=m.filter(x=>x.role==='to'&&x.type==='way');
  const viaNodes=m.filter(x=>x.role==='via'&&x.type==='node').map(x=>str(x.ref,32));const viaWays=m.filter(x=>x.role==='via'&&x.type==='way').map(x=>'osm-way-'+x.ref);
  if(from.length!==1||to.length!==1||!(viaNodes.length||viaWays.length)){stats.invalidRelations++;continue;}
  const fromWay='osm-way-'+from[0].ref,toWay='osm-way-'+to[0].ref;
  if(!roads.has(fromWay)||!roads.has(toWay)||viaWays.some(w=>!roads.has(w))||viaNodes.some(n=>!nodes.has(Number(n)))){stats.unresolvedRestrictions++;continue;}
  const tags=el.tags||{},conditional=str(tags['restriction:conditional']||tags['restriction:motorcar:conditional']||'',200);
  if(conditional)stats.unhandledConditionalRestrictions++;
  const restriction=str(tags.restriction||tags['restriction:motorcar']||tags['restriction:motor_vehicle']||'',100);
  relations.set('osm-relation-'+el.id,{restrictionId:'osm-relation-'+el.id,restriction,except:str(tags.except),fromWay,toWay,viaNodes,viaWays,conditional,applicability:conditional?'requires-conditional-evaluation':'unverified'});
 }
 return {roads:[...roads.values()],restrictions:[...relations.values()],nodeCoordinateCount:nodes.size,stats};
}
async function main(){const source=path.resolve(files[0]);const bytes=fs.readFileSync(source);const sha256=crypto.createHash('sha256').update(bytes).digest('hex');const input=JSON.parse(bytes.toString('utf8'));const data=build(input);const sourceVersion=str(input.osm3s?.timestamp_osm_base||'unversioned',100);
 const summary={ok:true,mode:write?'WRITE_REQUESTED':'DRY_RUN',database:DB,roadCollection:COLLECTION,restrictionCollection:RESTRICTIONS,sourceVersion,sha256,rawElements:input.elements.length,roadCount:data.roads.length,restrictionCount:data.restrictions.length,nodeCoordinateCount:data.nodeCoordinateCount,stats:data.stats,roadWithNodeIds:data.roads.filter(r=>r.nodeIds.length===r.geometry.coordinates.length).length,graphBuilt:false,routingEnforced:false,source:'OSM / ODbL',sample:data.roads.slice(0,3).map(r=>({roadId:r.roadId,name:r.name,nodeCount:r.nodeIds.length}))};console.log(JSON.stringify(summary,null,2));
 if(!write){console.log('DRY RUN: no database connection or writes.');return;}
 if(!data.roads.length||data.stats.missingNodes||data.stats.invalid||data.stats.unresolvedRestrictions||data.stats.invalidRelations)throw Error('Import blocked: incomplete or invalid source; review dry-run summary first');
 if(process.env.JALAN_V491_IMPORT_CONFIRM!==`${DB}.${COLLECTION}`)throw Error(`Import not authorized. Set JALAN_V491_IMPORT_CONFIRM=${DB}.${COLLECTION} only after review.`);
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:10000}).asPromise();
 try{if(conn.name!==DB)throw Error('Database mismatch');const {Road,Restriction}=models(conn);await Road.init();await Restriction.init();const importedAt=new Date();async function upsert(Model,items,id){let matched=0,upserted=0,modified=0;for(let i=0;i<items.length;i+=250){const ops=items.slice(i,i+250).map(x=>({updateOne:{filter:{[id]:x[id]},update:{$set:{...x,sourceVersion,importedAt}},upsert:true}}));const r=await Model.bulkWrite(ops,{ordered:false});matched+=r.matchedCount;upserted+=r.upsertedCount;modified+=r.modifiedCount;}return {matched,upserted,modified};}const roadResult=await upsert(Road,data.roads,'roadId');const restrictionResult=await upsert(Restriction,data.restrictions,'restrictionId');console.log(JSON.stringify({ok:true,database:DB,roadResult,restrictionResult,sourceVersion,sha256,note:'Old versions and live routing unchanged; stale records are not deleted.'}));}finally{await conn.close();}
}
if(require.main===module)main().catch(e=>{console.error('Import failed:',e.message);process.exitCode=1;});
module.exports={build};
