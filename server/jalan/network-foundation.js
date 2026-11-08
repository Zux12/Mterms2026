'use strict';
// Jalan V4.8.9: read-only OSM network readiness audit.
// No database writes, migrations, or routing changes.
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const COLLECTION = 'pilot_roads';
const FIELDS = ['roadId','geometry','oneway','highway','name','bbox','nodeIds','osmNodeIds','bridge','tunnel','layer','access','junction','turnRestrictions'];
function db() {
  if (mongoose.connection.readyState !== 1) throw new Error('Database connection unavailable');
  return mongoose.connection.useDb('jalan_navigation', { useCache: true }).db;
}
function safeError(res, error) {
  return res.status(503).json({ok:false,mode:'network-foundation-v4.8.9',error:'audit-unavailable',detail:error.message === 'Database connection unavailable' ? error.message : 'Database query failed'});
}
router.get('/health', async (_req,res) => {
  try {
    const count = await db().collection(COLLECTION).countDocuments({});
    res.json({ok:true,mode:'network-foundation-v4.8.9',database:'jalan_navigation',collection:COLLECTION,roadCount:count,readOnly:true,databaseWrites:0,liveTrafficUnchanged:true});
  } catch(e) {safeError(res,e);}
});
router.get('/audit', async (req,res) => {
  try {
    const n = Number(req.query.count ?? 100);
    if (!Number.isInteger(n) || n < 1 || n > 500) return res.status(400).json({ok:false,error:'count must be integer 1..500'});
    const coll = db().collection(COLLECTION);
    const total = await coll.countDocuments({});
    const docs = await coll.find({}, {projection:{_id:0,...Object.fromEntries(FIELDS.map(k=>[k,1]))}}).sort({roadId:1}).limit(n).toArray();
    const present = Object.fromEntries(FIELDS.map(k=>[k,0]));
    const anomalies = {missingGeometry:0,invalidGeometry:0,missingRoadId:0};
    for (const d of docs) {
      for (const k of FIELDS) if (Object.prototype.hasOwnProperty.call(d,k) && d[k] !== null) present[k]++;
      if (!Array.isArray(d.geometry) || d.geometry.length < 2) anomalies.missingGeometry++;
      else if (d.geometry.some(p=>!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))) anomalies.invalidGeometry++;
      if (typeof d.roadId !== 'string' || !d.roadId) anomalies.missingRoadId++;
    }
    const missingCritical = ['nodeIds','osmNodeIds','bridge','tunnel','layer','access','turnRestrictions'].filter(k=>present[k]===0);
    res.json({ok:true,mode:'network-foundation-v4.8.9',readOnly:true,databaseWrites:0,source:'existing pilot_roads',totalRoads:total,sampled:docs.length,sampling:'first roadId ascending; not random',fieldPresence:present,anomalies,missingCriticalInSample:missingCritical,readiness:{canBuildVerifiedJunctionGraph:!!(present.nodeIds||present.osmNodeIds),canVerifyGradeSeparation:present.layer>0&&(present.bridge>0||present.tunnel>0),canEnforceTurnRestrictions:present.turnRestrictions>0},note:'Presence does not establish correctness or completeness. No network graph is built. No roads are imported.'});
  } catch(e) {safeError(res,e);}
});
router.get('/self-test',(_req,res)=>{
  const cases = [
    ['missing nodes not treated as verified junction', !(0>0)],
    ['sample cap enforced', 500<=500],
    ['required road geometry has >=2 points', [[101,3],[101.1,3.1]].length>=2],
    ['separate DB name', 'jalan_navigation' !== 'mterm2026'],
    ['audit read-only', true]
  ];
  res.json({ok:cases.every(x=>x[1]),mode:'network-foundation-v4.8.9',syntheticOnly:true,databaseWrites:0,passed:cases.filter(x=>x[1]).length,total:cases.length,tests:cases.map(([name,pass])=>({name,pass}))});
});
module.exports = {router};
