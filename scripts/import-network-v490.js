'use strict';
// Usage: node scripts/import-network-v490.js roads.json [--write]
// Default dry run. Writes ONLY to jalan_navigation road_network_v490 / road_turn_restrictions_v490.
require('dotenv').config();
const fs=require('fs');const path=require('path');const mongoose=require('mongoose');
const {models,DB,COLLECTION,RESTRICTIONS}=require('../server/jalan/network-v490');
const args=process.argv.slice(2),write=args.includes('--write'),files=args.filter(x=>!x.startsWith('--'));
if(files.length!==1||args.some(x=>x.startsWith('--')&&x!=='--write')){console.error('Usage: node scripts/import-network-v490.js roads.json [--write]');process.exit(1);}
const allowed=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const bounds={south:1.0,north:6.9,west:99.0,east:104.8}; // Peninsular Malaysia envelope, not precise national boundary
function str(v,n=150){return String(v??'').slice(0,n);}
function region(lon,lat){return `${Math.floor(lat*10)/10}:${Math.floor(lon*10)/10}`;}
function build(input){
 if(!Array.isArray(input.elements))throw Error('Expected Overpass JSON with elements array');
 const ways=new Map(),relations=new Map();const skipped={nonRoad:0,invalid:0,outOfBounds:0,missingGeometry:0,missingNodes:0};
 const nodeCoordinates=new Map();
 for(const el of input.elements)if(el.type==='node'&&Number.isSafeInteger(el.id)&&Number.isFinite(el.lon)&&Number.isFinite(el.lat))nodeCoordinates.set(el.id,[el.lon,el.lat]);
 for(const el of input.elements){
  if(el.type==='relation'&&el.tags?.type==='restriction'&&Number.isSafeInteger(el.id)){
   const m=Array.isArray(el.members)?el.members:[];
   const from=m.find(x=>x.role==='from'&&x.type==='way');const to=m.find(x=>x.role==='to'&&x.type==='way');
   const viaNodes=m.filter(x=>x.role==='via'&&x.type==='node').map(x=>String(x.ref));
   const viaWays=m.filter(x=>x.role==='via'&&x.type==='way').map(x=>String(x.ref));
   if(from&&to&&(viaNodes.length||viaWays.length))relations.set('osm-relation-'+el.id,{restrictionId:'osm-relation-'+el.id,restriction:str(el.tags.restriction||el.tags['restriction:motorcar']||''),except:str(el.tags.except||''),fromWay:'osm-way-'+from.ref,toWay:'osm-way-'+to.ref,viaNodes,viaWays});
   continue;
  }
  if(el.type!=='way'||!allowed.has(el.tags?.highway)){skipped.nonRoad++;continue;}
  if(!Number.isSafeInteger(el.id)){skipped.invalid++;continue;}
  const nodeIds=Array.isArray(el.nodes)?el.nodes.filter(Number.isSafeInteger).map(String):[];
  let coordinates=Array.isArray(el.geometry)?el.geometry.map(p=>[p.lon,p.lat]):nodeIds.map(n=>nodeCoordinates.get(Number(n)));
  if(coordinates.length<2||coordinates.length>10000||coordinates.some(p=>!p||p.length!==2||!p.every(Number.isFinite))){skipped.missingGeometry++;continue;}
  if(!nodeIds.length||nodeIds.length!==coordinates.length)skipped.missingNodes++;
  if(el.tags?.oneway==='-1'){coordinates.reverse();nodeIds.reverse();}
  const xs=coordinates.map(p=>p[0]),ys=coordinates.map(p=>p[1]);const bbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  if(bbox[0]<bounds.west||bbox[2]>bounds.east||bbox[1]<bounds.south||bbox[3]>bounds.north){skipped.outOfBounds++;continue;}
  const tags=el.tags||{};
  const oneway=['yes','1','true','-1'].includes(tags.oneway)||tags.junction==='roundabout'||['motorway','motorway_link'].includes(tags.highway);
  const layer=tags.layer===undefined?null:Number(tags.layer);
  ways.set('osm-way-'+el.id,{roadId:'osm-way-'+el.id,name:str(tags.name,200),highway:str(tags.highway),oneway,maxspeed:str(tags.maxspeed,60),nodeIds,bridge:str(tags.bridge||''),tunnel:str(tags.tunnel||''),layer:Number.isFinite(layer)?layer:null,access:str(tags.access||''),motorVehicle:str(tags.motor_vehicle||''),vehicle:str(tags.vehicle||''),junction:str(tags.junction||''),geometry:{type:'LineString',coordinates},bbox,regionKey:region((bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2),tags:{oneway:tags.oneway||'',surface:tags.surface||''}});
 }
 return {roads:[...ways.values()],restrictions:[...relations.values()],skipped,nodeCoordinateCount:nodeCoordinates.size};
}
async function main(){const input=JSON.parse(fs.readFileSync(path.resolve(files[0]),'utf8'));const data=build(input);
 const sourceVersion=str(input.osm3s?.timestamp_osm_base||input.version||'unversioned',100);
 const summary={mode:write?'WRITE':'DRY_RUN',target:`${DB}.${COLLECTION}`,restrictionsTarget:`${DB}.${RESTRICTIONS}`,sourceVersion,roads:data.roads.length,restrictions:data.restrictions.length,nodeCoordinateCount:data.nodeCoordinateCount,skipped:data.skipped,roadsWithNodeIds:data.roads.filter(x=>x.nodeIds.length===x.geometry.coordinates.length).length,sample:data.roads.slice(0,3).map(x=>({roadId:x.roadId,name:x.name,nodeCount:x.nodeIds.length,bridge:x.bridge,layer:x.layer,regionKey:x.regionKey}))};
 console.log(JSON.stringify(summary,null,2));
 if(!write){console.log('DRY RUN: no database connection or writes.');return;}
 if(!data.roads.length)throw Error('Refusing zero-road import');
 if(process.env.JALAN_V490_IMPORT_CONFIRM!==`${DB}.${COLLECTION}`)throw Error(`Set JALAN_V490_IMPORT_CONFIRM=${DB}.${COLLECTION} to authorize`);
 if(!process.env.MTERM2026_DB_URI)throw Error('MTERM2026_DB_URI missing');
 const conn=await mongoose.createConnection(process.env.MTERM2026_DB_URI,{dbName:DB,serverSelectionTimeoutMS:10000}).asPromise();
 try{if(conn.name!==DB)throw Error('Database mismatch');const {Road,Restriction}=models(conn);await Promise.all([Road.init(),Restriction.init()]);
  const importedAt=new Date();async function upsert(Model,items,id){let matched=0,upserted=0,modified=0;for(let i=0;i<items.length;i+=300){const batch=items.slice(i,i+300).map(x=>({updateOne:{filter:{[id]:x[id]},update:{$set:{...x,sourceVersion,importedAt}},upsert:true}}));const r=await Model.bulkWrite(batch,{ordered:false});matched+=r.matchedCount;upserted+=r.upsertedCount;modified+=r.modifiedCount;}return {matched,upserted,modified};}
  const roads=await upsert(Road,data.roads,'roadId');const restrictions=await upsert(Restriction,data.restrictions,'restrictionId');console.log(JSON.stringify({ok:true,database:conn.name,roads,restrictions,warning:'Existing records not in this import are NOT deleted; this is not a complete national graph.'}));
 }finally{await conn.close();}
}
main().catch(e=>{console.error('Import failed:',e.message);process.exitCode=1;});
