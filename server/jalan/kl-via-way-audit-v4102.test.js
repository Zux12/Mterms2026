'use strict';
// Static real-KL OSM road identifiers / directed endpoints, read from v495 read-only
// on 2026-11-11. Source: OpenStreetMap contributors (ODbL). No user GPS traces.
const test=require('node:test'),assert=require('node:assert/strict');
const {auditViaWayPathCandidates,directedWayRuns}=require('./kl-via-way-audit-v4102');
const {auditTurnCandidates}=require('./kl-turn-audit-v4102');
const e=(id,from,to)=>({id,fromNode:from,toNode:to});
const restrictedViaWay=[
 e('osm-way-761937946:0:F','7118946719','7118946718'),
 e('osm-way-761937951:0:F','7118946718','7118946726'),
 e('osm-way-761937950:0:F','7118946726','7118946720')
];
const viaWay={
 restrictionId:'osm-relation-10560396',fromWay:'osm-way-761937946',
 toWay:'osm-way-761937950',viaNodes:[],viaWays:['osm-way-761937951'],
 restriction:'no_u_turn',applicability:'unverified',conditional:'',except:''
};
test('real KL via-way relation is recognized only as an ordered path pattern',()=>{
 const r=auditViaWayPathCandidates(restrictedViaWay,[viaWay]);
 assert.equal(r.viaWayRelationsUnassessed,1);
 assert.equal(r.viaWayPathCandidateCount,1);
 assert.equal(r.viaWayPathCandidates[0].restrictionId,'osm-relation-10560396');
 assert.equal(r.viaWayPathCandidates[0].kind,'via_way_path_pattern_only');
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.legalDrivingRouteVerified,false);
});
test('real KL via-node transition remains distinguishable from via-way pattern',()=>{
 const incoming=e('osm-way-740876360:2:F','6936246002','3846082837');
 const outgoing=e('osm-way-740876358:0:F','3846082837','6936246003');
 const restriction={restrictionId:'osm-relation-10243706',
  fromWay:'osm-way-740876360',toWay:'osm-way-740876358',
  viaNodes:['3846082837'],viaWays:[],restriction:'no_right_turn',applicability:'unverified'};
 assert.equal(auditTurnCandidates([incoming,outgoing],[restriction]).potentialTurnRestrictionReviewCount,1);
 assert.equal(auditViaWayPathCandidates([incoming,outgoing],[restriction]).viaWayPathCandidateCount,0);
});
test('no via-way warning on reverse, wrong exit or disconnected directed links',()=>{
 const [a,b,c]=restrictedViaWay;
 assert.equal(auditViaWayPathCandidates([c,b,a],[viaWay]).viaWayPathCandidateCount,0);
 assert.equal(auditViaWayPathCandidates([a,b,e('osm-way-99:0:F',b.toNode,'x')],[viaWay]).viaWayPathCandidateCount,0);
 const disconnected=e(b.id,'not-shared',b.toNode);
 assert.equal(auditViaWayPathCandidates([a,disconnected,c],[viaWay]).viaWayPathCandidateCount,0);
});
test('multiple consecutive segments on a via-way form one directed run',()=>{
 const [a,,c]=restrictedViaWay;
 const b1=e('osm-way-761937951:0:F','7118946718','intermediate');
 const b2=e('osm-way-761937951:1:F','intermediate','7118946726');
 const path=[a,b1,b2,c];
 assert.deepEqual(directedWayRuns(path).map(r=>r.way),
 ['osm-way-761937946','osm-way-761937951','osm-way-761937950']);
 const result=auditViaWayPathCandidates(path,[viaWay]);
 assert.equal(result.viaWayPathCandidateCount,1);
 assert.equal(result.viaWayPathCandidates[0].endEdgeIndex,3);
});
test('malformed mixed/conditional via-way relations stay unassessed and preserve caveats',()=>{
 const withConditions={...viaWay,conditional:'Mo-Fr 07:00-09:00',except:'bus'};
 const mixed={...viaWay,viaNodes:['123']};
 const result=auditViaWayPathCandidates(restrictedViaWay,[withConditions,mixed]);
 assert.equal(result.viaWayRelationsUnassessed,2);
 assert.equal(result.viaWayPathCandidateCount,1);
 assert.equal(result.viaWayPathCandidates[0].conditional,true);
 assert.equal(result.viaWayPathCandidates[0].except,true);
});
test('empty/malformed input never yields fabricated matches',()=>{
 assert.equal(auditViaWayPathCandidates([],[]).viaWayPathCandidateCount,0);
 assert.throws(()=>auditViaWayPathCandidates(null,[]),TypeError);
 assert.throws(()=>auditViaWayPathCandidates([],null),TypeError);
});

test('no_* match is separately reported as possible violation, not permitted-exit proof',()=>{
 const r=auditViaWayPathCandidates(restrictedViaWay,[viaWay]);
 assert.equal(r.viaWayPathCandidateCount,1);
 assert.equal(r.viaWayNoTurnCandidateCount,1);
 assert.equal(r.viaWayOnlyDesignatedExitPatternCount,0);
 assert.equal(r.viaWayPathCandidates[0].restrictionClass,'no_turn_path_candidate');
 assert.equal(r.viaWayRelationsEligible,1);
 assert.equal(r.viaWayRelationsUnsupported,0);
});
test('only_* designated exit is not incorrectly counted as a no-turn candidate',()=>{
 const only={...viaWay,restriction:'only_right_turn'};
 const r=auditViaWayPathCandidates(restrictedViaWay,[only]);
 assert.equal(r.viaWayPathCandidateCount,1);
 assert.equal(r.viaWayNoTurnCandidateCount,0);
 assert.equal(r.viaWayOnlyDesignatedExitPatternCount,1);
 assert.equal(r.viaWayPathCandidates[0].restrictionClass,'only_designated_exit_pattern');
 assert.equal(r.turnRestrictionsEnforced,false);
});
test('mixed/unsupported relations remain in unassessed total but are excluded from eligible',()=>{
 const unsupported={...viaWay,viaNodes:['unexpected-node']};
 const r=auditViaWayPathCandidates(restrictedViaWay,[viaWay,unsupported]);
 assert.equal(r.viaWayRelationsUnassessed,2);
 assert.equal(r.viaWayRelationsEligible,1);
 assert.equal(r.viaWayRelationsUnsupported,1);
 assert.equal(r.viaWayNoTurnCandidateCount,1);
 assert.equal(r.viaWayOnlyDesignatedExitPatternCount,0);
});
