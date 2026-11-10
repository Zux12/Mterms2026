'use strict';
// No MongoDB and no network required: the importer is NOT assumed to be authoritative.
const test=require('node:test'),assert=require('node:assert/strict');
const {auditTurnCandidates,wayOf}=require('./kl-turn-audit-v4102');
const e=(id,from,to)=>({id,fromNode:from,toNode:to});
const ab=e('osm-way-11:0:F','a','v');
const bc=e('osm-way-22:0:F','v','c');
const bd=e('osm-way-33:0:F','v','d');
const via=(restriction,fromWay='osm-way-11',toWay='osm-way-22')=>({
 restrictionId:'osm-relation-1',fromWay,toWay,viaNodes:['v'],viaWays:[],
 restriction,applicability:'unverified',conditional:'',except:''
});
test('OSM edge identifiers map to imported restriction way identifiers',()=>{
 assert.equal(wayOf(ab),'osm-way-11');assert.equal(wayOf({id:'osm-way-11:12:R'}),'osm-way-11');
 assert.equal(wayOf({roadId:'osm-way-5',id:'unknown'}),'osm-way-5');
 assert.equal(wayOf({id:'garbage'}),null);
});
test('exact via-node no-turn match produces warning, not legal enforcement',()=>{
 const r=auditTurnCandidates([ab,bc],[via('no_left_turn')]);
 assert.equal(r.transitionsInspected,1);
 assert.equal(r.potentialTurnRestrictionReviewCount,1);
 assert.equal(r.potentialTurnRestrictions[0].kind,'no_turn_candidate');
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.legalDrivingRouteVerified,false);
});
test('no-turn records do not flag other outgoing roads or wrong junctions',()=>{
 assert.equal(auditTurnCandidates([ab,bd],[via('no_left_turn')]).potentialTurnRestrictionReviewCount,0);
 const wrong={...via('no_left_turn'),viaNodes:['other']};
 assert.equal(auditTurnCandidates([ab,bc],[wrong]).potentialTurnRestrictionReviewCount,0);
 assert.equal(auditTurnCandidates([ab,e('osm-way-22:0:F','x','c')],[via('no_left_turn')]).transitionsInspected,0);
});
test('only-turn restrictions flag departures to non-designated way',()=>{
 const r=via('only_straight_on');
 assert.equal(auditTurnCandidates([ab,bc],[r]).potentialTurnRestrictionReviewCount,0);
 const invalid=auditTurnCandidates([ab,bd],[r]);
 assert.equal(invalid.potentialTurnRestrictions[0].kind,'only_turn_mismatch_candidate');
});
test('via-way and multi-via relations are unassessed, never silently cleared',()=>{
 const viaWay={...via('no_left_turn'),viaNodes:[],viaWays:['osm-way-99']};
 const multiVia={...via('no_left_turn'),viaNodes:['v','q']};
 const unknown={...via('yield'),restriction:'yield'};
 const r=auditTurnCandidates([ab,bc],[viaWay,multiVia,unknown]);
 assert.equal(r.potentialTurnRestrictionReviewCount,0);
 assert.equal(r.complexRestrictionsUnassessed,3);
 assert.equal(r.turnRestrictionsEnforced,false);
});
test('exceptions/conditions are preserved in potential candidate metadata',()=>{
 const record={...via('no_right_turn'),conditional:'Mo-Fr 08:00-09:00',except:'bus'};
 const r=auditTurnCandidates([ab,bc],[record]);
 assert.equal(r.potentialTurnRestrictionReviewCount,1);
 assert.equal(r.potentialTurnRestrictions[0].conditional,true);
 assert.equal(r.potentialTurnRestrictions[0].except,true);
 assert.equal(r.potentialTurnRestrictions[0].applicability,'unverified');
});
test('same-way no_u_turn distinguishes straight continuation from reversal',()=>{
 const straight=e('osm-way-11:1:F','v','c');
 const back=e('osm-way-11:0:R','v','a');
 const r=via('no_u_turn','osm-way-11','osm-way-11');
 assert.equal(auditTurnCandidates([ab,straight],[r]).potentialTurnRestrictionReviewCount,0);
 assert.equal(auditTurnCandidates([ab,back],[r]).potentialTurnRestrictionReviewCount,1);
});
test('empty paths and malformed inputs fail conservatively',()=>{
 assert.equal(auditTurnCandidates([],[]).potentialTurnRestrictionReviewCount,0);
 assert.throws(()=>auditTurnCandidates(null,[]),TypeError);
 assert.throws(()=>auditTurnCandidates([],null),TypeError);
});
