'use strict';
// Isolated v4.9.0 road network storage. Does not alter pilot_roads or observations.
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const DB = 'jalan_navigation';
const COLLECTION = 'road_network_v490';
const RESTRICTIONS = 'road_turn_restrictions_v490';
const schema = new mongoose.Schema({
 roadId:{type:String,required:true}, sourceVersion:String, importedAt:Date,
 name:String, highway:String, oneway:Boolean, maxspeed:String,
 nodeIds:[String], bridge:String, tunnel:String, layer:Number, access:String,
 motorVehicle:String, vehicle:String, junction:String,
 geometry:{type:{type:String,default:'LineString'},coordinates:[[Number]]},
 bbox:[Number], regionKey:String, tags:{type:mongoose.Schema.Types.Mixed}
},{strict:true,versionKey:false});
schema.index({roadId:1},{unique:true});
schema.index({geometry:'2dsphere'});
schema.index({regionKey:1,roadId:1});
const restrictionSchema = new mongoose.Schema({restrictionId:{type:String,required:true},sourceVersion:String,restriction:String,except:String,fromWay:String,toWay:String,viaNodes:[String],viaWays:[String],importedAt:Date},{versionKey:false});
restrictionSchema.index({restrictionId:1},{unique:true});
restrictionSchema.index({fromWay:1,toWay:1});
function models(conn){return {Road:conn.models.JalanNetwork490Road||conn.model('JalanNetwork490Road',schema,COLLECTION),Restriction:conn.models.JalanNetwork490Restriction||conn.model('JalanNetwork490Restriction',restrictionSchema,RESTRICTIONS)};}
function db(){return mongoose.connection.useDb(DB,{useCache:true});}
router.get('/health',async(_req,res)=>{try{const {Road,Restriction}=models(db());const [roads,restrictions]=await Promise.all([Road.countDocuments(),Restriction.countDocuments()]);res.json({ok:true,mode:'network-foundation-v4.9.0',database:DB,collections:[COLLECTION,RESTRICTIONS],roadCount:roads,restrictionCount:restrictions,readOnly:true,liveTrafficUnchanged:true});}catch(e){res.status(503).json({ok:false,error:'network database unavailable'});}});
router.get('/audit',async(req,res)=>{try{const limit=Math.max(1,Math.min(1000,Number.parseInt(req.query.count,10)||100));const {Road,Restriction}=models(db());const docs=await Road.find({}).sort({roadId:1}).limit(limit).lean();const fields=['nodeIds','bridge','tunnel','layer','access','motorVehicle','vehicle','junction'];const present=Object.fromEntries(fields.map(k=>[k,docs.filter(d=>k==='nodeIds'?Array.isArray(d[k])&&d[k].length>0:d[k]!==undefined&&d[k]!==null&&d[k]!=='').length]));res.json({ok:true,mode:'network-foundation-v4.9.0',readOnly:true,sampled:docs.length,fieldPresence:present,restrictionCount:await Restriction.countDocuments(),verifiedJunctionGraphBuilt:false,turnRestrictionsEnforcedInRouting:false,note:'Attribute presence does not establish valid connectivity, legal turns, or GPS accuracy.'});}catch(e){res.status(503).json({ok:false,error:'audit unavailable'});}});
router.get('/self-test',(_req,res)=>{const tests=[['separate database',DB==='jalan_navigation'],['separate road collection',COLLECTION!=='pilot_roads'],['separate restrictions collection',RESTRICTIONS!==COLLECTION],['geojson geometry',schema.path('geometry')!==undefined],['node IDs stored',schema.path('nodeIds')!==undefined],['access stored',schema.path('access')!==undefined]];res.json({ok:tests.every(t=>t[1]),passed:tests.filter(t=>t[1]).length,total:tests.length,syntheticOnly:true,databaseWrites:0,tests:tests.map(([name,pass])=>({name,pass}))});});
module.exports={router,models,DB,COLLECTION,RESTRICTIONS};
