'use strict';
// End-to-end (pure graph) coverage for advisory integration. Never enforces turns.
const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681],C=[3.141,101.681],D=[3.139,101.681];
const edge=(id,from,to,a,b)=>({id,from,to,a,b,len:distance(a,b)});
const ab=edge('osm-way-11:0:F','a','v',A,B);
const bc=edge('osm-way-22:0:F','v','c',B,C);
const bd=edge('osm-way-33:0:F','v','d',B,D);
const snap=(e,t)=>({edge:e,t,point:[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t]});
const graph=(edges,turnRestrictions)=>{const adj=new Map();for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}return {adj,edges,turnRestrictions};};
const turn=(restriction,fromWay='osm-way-11',toWay='osm-way-22')=>({
 restrictionId:'osm-relation-1',fromWay,toWay,viaNodes:['v'],viaWays:[],restriction,applicability:'unverified',conditional:'',except:''
});
test('partial start/end edges still surface unverified direct-turn candidate',()=>{
 const r=calculate(graph([ab,bc],[turn('no_left_turn')]),snap(ab,.8),snap(bc,.2));
 assert.ok(r);assert.equal(r.edgeCount,2);
 assert.equal(r.turnReviewAvailable,true);
 assert.equal(r.turnReviewTransitionsInspected,1);
 assert.equal(r.potentialTurnRestrictionReviewCount,1);
});
test('only-turn mismatch is surfaced but not used to change route selection',()=>{
 const r=calculate(graph([ab,bd],[turn('only_right_turn')]),snap(ab,.8),snap(bd,.2));
 assert.ok(r);assert.equal(r.edgeCount,2);
 assert.equal(r.potentialTurnRestrictionReviewCount,1);
});
test('same edge and missing restriction data are not falsely reported clear',()=>{
 const missing=calculate(graph([ab],null),snap(ab,.2),snap(ab,.8));
 assert.ok(missing);
 assert.equal(missing.turnReviewAvailable,false);
 assert.equal(missing.potentialTurnRestrictionReviewCount,null);
 const loaded=calculate(graph([ab],[turn('no_left_turn')]),snap(ab,.2),snap(ab,.8));
 assert.ok(loaded);
 assert.equal(loaded.turnReviewAvailable,true);
 assert.equal(loaded.potentialTurnRestrictionReviewCount,0);
 assert.equal(loaded.turnReviewTransitionsInspected,0);
});
test('complex via-way restrictions remain explicitly unassessed',()=>{
 const relation={...turn('no_left_turn'),viaNodes:[],viaWays:['osm-way-77']};
 const r=calculate(graph([ab,bc],[relation]),snap(ab,.3),snap(bc,.6));
 assert.equal(r.potentialTurnRestrictionReviewCount,0);
 assert.equal(r.turnReviewComplexRecordsUnassessed,1);
});

test('read-only preview surfaces real KL via-way pattern but does not enforce it',()=>{
 // OpenStreetMap contributors, ODbL. Three directed edges sampled from v495.
 const p0=[3.1025633,101.6660873],p1=[3.1026564,101.6660847];
 const p2=[3.1026598,101.6661589],p3=[3.1025678,101.6661664];
 const from=edge('osm-way-761937946:0:F','7118946719','7118946718',p0,p1);
 const via=edge('osm-way-761937951:0:F','7118946718','7118946726',p1,p2);
 const to=edge('osm-way-761937950:0:F','7118946726','7118946720',p2,p3);
 const relation={
  restrictionId:'osm-relation-10560396',fromWay:'osm-way-761937946',
  toWay:'osm-way-761937950',viaNodes:[],viaWays:['osm-way-761937951'],
  restriction:'no_u_turn',applicability:'unverified',conditional:'',except:''
 };
 const r=calculate(graph([from,via,to],[relation]),snap(from,.6),snap(to,.4));
 assert.ok(r);assert.equal(r.edgeCount,3);
 assert.equal(r.turnReviewViaWayPathCandidateCount,1);
 assert.equal(r.turnReviewViaWayRelationsUnassessed,1);
 assert.equal(r.turnReviewComplexRecordsUnassessed,1);
 assert.equal(r.turnReviewViaWayPatternAdvisoryOnly,true);
});
test('missing turn import reports unknown via-way status rather than zero',()=>{
 const r=calculate(graph([ab],null),snap(ab,.1),snap(ab,.9));
 assert.ok(r);
 assert.equal(r.turnReviewAvailable,false);
 assert.equal(r.turnReviewViaWayPathCandidateCount,null);
 assert.equal(r.turnReviewViaWayRelationsUnassessed,null);
});
