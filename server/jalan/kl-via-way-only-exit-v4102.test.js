'use strict';
// Read-only KL OSM fixture from road_graph_edges_v495 and road_turn_restrictions_v493
// (2026-11-11; OpenStreetMap contributors, ODbL). Advisory ONLY: no traffic law
// evaluation, destination exceptions, signage verification, or route enforcement.
const test=require('node:test'),assert=require('node:assert/strict');
const {auditViaWayPathCandidates}=require('./kl-via-way-audit-v4102');
const e=(id,fromNode,toNode)=>({id,fromNode,toNode});
const from=e('osm-way-1097851190:0:F','9201507292','1788202342');
const via=e('osm-way-755896646:0:F','1788202342','7059996209');
const allowed=e('osm-way-755896647:0:F','7059996209','7059996207');
const alternative=e('osm-way-755896648:0:F','7059996209','7549218898');
const restriction={
 restrictionId:'osm-relation-14624187',fromWay:'osm-way-1097851190',
 viaNodes:[],viaWays:['osm-way-755896646'],
 toWay:'osm-way-755896647',restriction:'only_straight_on',
 applicability:'unverified',conditional:'',except:''
};
test('actual KL permitted exit is an exact pattern, not an only-exit mismatch',()=>{
 const result=auditViaWayPathCandidates([from,via,allowed],[restriction]);
 assert.equal(result.viaWayPathCandidateCount,1);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,0);
 assert.equal(result.turnRestrictionsEnforced,false);
 assert.equal(result.legalDrivingRouteVerified,false);
});
test('actual KL alternate exit after exact directed prefix triggers advisory',()=>{
 const result=auditViaWayPathCandidates([from,via,alternative],[restriction]);
 assert.equal(result.viaWayPathCandidateCount,0);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,1);
 const candidate=result.viaWayOnlyExitMismatchCandidates[0];
 assert.equal(candidate.restrictionId,'osm-relation-14624187');
 assert.equal(candidate.kind,'via_way_only_exit_mismatch_candidate');
 assert.equal(candidate.startEdgeIndex,0);
 assert.equal(candidate.endEdgeIndex,2);
 assert.equal(candidate.expectedToWay,'osm-way-755896647');
 assert.equal(candidate.observedToWay,'osm-way-755896648');
 assert.equal(result.turnRestrictionsEnforced,false);
});
test('no_* via-way relation does not flag a different exit as its target',()=>{
 const result=auditViaWayPathCandidates([from,via,alternative],[{...restriction,restriction:'no_right_turn'}]);
 assert.equal(result.viaWayPathCandidateCount,0);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,0);
});
test('disconnected alternate exit never produces candidate',()=>{
 const disconnected=e(alternative.id,'other-node',alternative.toNode);
 const result=auditViaWayPathCandidates([from,via,disconnected],[restriction]);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,0);
});
test('route ending on via-way cannot determine selected exit',()=>{
 const result=auditViaWayPathCandidates([from,via],[restriction]);
 assert.equal(result.viaWayPathCandidateCount,0);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,0);
 assert.equal(result.viaWayRelationsUnassessed,1);
});
test('alternate exit candidate retains exemption and conditional uncertainty',()=>{
 const annotated={...restriction,conditional:'Mo-Fr 07:00-09:00',except:'bus'};
 const result=auditViaWayPathCandidates([from,via,alternative],[annotated]);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,1);
 assert.equal(result.viaWayOnlyExitMismatchCandidates[0].conditional,true);
 assert.equal(result.viaWayOnlyExitMismatchCandidates[0].except,true);
});
test('multiple via-ways match only when all directed links are continuous',()=>{
 const second=e('osm-way-99:0:F',via.toNode,'after-second');
 const exit=e('osm-way-98:0:F','after-second','end');
 const relation={...restriction,viaWays:[...restriction.viaWays,'osm-way-99'],toWay:'osm-way-97'};
 const result=auditViaWayPathCandidates([from,via,second,exit],[relation]);
 assert.equal(result.viaWayOnlyExitMismatchCandidateCount,1);
 assert.equal(result.viaWayOnlyExitMismatchCandidates[0].viaWayCount,2);
 const broken=e(second.id,'not-connected',second.toNode);
 assert.equal(auditViaWayPathCandidates([from,via,broken,exit],[relation]).viaWayOnlyExitMismatchCandidateCount,0);
});
