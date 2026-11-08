'use strict';
// One-time CLI import of an operator-reviewed Overpass JSON export.
// Run with: node scripts/import-roads.js ./roads.json
require('dotenv').config();
const fs=require('fs');const mongoose=require('mongoose');
const file=process.argv[2];if(!file){console.error('Usage: node scripts/import-roads.js roads.json');process.exit(1);}
const {Road}=require('../server/jalan/road-pilot');
async function main(){
 const input=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(input.elements))throw Error('Expected Overpass JSON elements array');
 const allowed=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','motorway_link','trunk_link','primary_link','secondary_link']);
 const roads=[];
 for(const el of input.elements){
  if(el.type!=='way'||!allowed.has(el.tags?.highway)||el.tags?.oneway==='-1'||!Array.isArray(el.geometry)||el.geometry.length<2)continue;
  const geometry=el.geometry.map(p=>[p.lon,p.lat]);
  if(geometry.some(p=>!p.every(Number.isFinite)))continue;
  const xs=geometry.map(p=>p[0]),ys=geometry.map(p=>p[1]);
  if(Math.min(...ys)<2.8||Math.max(...ys)>3.5||Math.min(...xs)<101.3||Math.max(...xs)>102)continue;
  roads.push({roadId:'osm-way-'+el.id,name:String(el.tags.name||''),highway:el.tags.highway,oneway:['yes','1','true'].includes(el.tags.oneway)||el.tags.junction==='roundabout',maxspeed:String(el.tags.maxspeed||''),geometry,bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]});
 }
 if(roads.length>5000)throw Error('Pilot limit 5000 roads; narrow the export');
 await mongoose.connect(process.env.MTERM2026_DB_URI,{dbName:'jalan_navigation'});
 const ops=roads.map(r=>({updateOne:{filter:{roadId:r.roadId},update:{$set:r},upsert:true}}));
 const result=ops.length?await Road.bulkWrite(ops,{ordered:false}):{upsertedCount:0,modifiedCount:0};
 console.log(JSON.stringify({parsed:roads.length,upserted:result.upsertedCount,modified:result.modifiedCount,database:'jalan_navigation'}));
 await mongoose.disconnect();
}
main().catch(e=>{console.error(e.message);process.exit(1)});
