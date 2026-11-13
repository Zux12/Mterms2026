'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {classifyTurnEnforcement}=require('./kl-turn-enforcement-readiness-v4102');
const relation={restrictionId:'osm-relation-10341546',fromWay:'osm-way-1339792254',
 toWay:'osm-way-607581032',viaNodes:['5757831665'],viaWays:[],
 restriction:'no_right_turn',applicability:'unverified',conditional:'',except:''};
test('real imported KL no-right-turn cannot be enforced without applicability review',()=>{
 const r=classifyTurnEnforcement([relation]);
 assert.equal(r.counts.unverified,1);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('verified simple relation is eligible but still never activates routing',()=>{
 const r=classifyTurnEnforcement([{...relation,applicability:'verified'}]);
 assert.equal(r.counts.verifiedSimple,1);
 assert.equal(r.eligible.length,1);
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('conditional, exception and via-way records are excluded even if verified',()=>{
 const r=classifyTurnEnforcement([
  {...relation,applicability:'verified',conditional:'Mo-Fr 08:00-09:00'},
  {...relation,applicability:'verified',except:'bus'},
  {...relation,applicability:'verified',viaNodes:[],viaWays:['osm-way-123']}
 ]);
 assert.equal(r.counts.conditionalOrExcept,2);
 assert.equal(r.counts.complex,1);
 assert.equal(r.eligible.length,0);
});
test('malformed or empty input never yields enforcement approval',()=>{
 assert.equal(classifyTurnEnforcement([]).allRestrictionsReady,false);
 assert.equal(classifyTurnEnforcement([null]).counts.malformed,1);
 assert.throws(()=>classifyTurnEnforcement(null),TypeError);
});

test('overlapping complexity flags count conditions even on unsupported via-way records',()=>{
 const r=classifyTurnEnforcement([
  {...relation,viaNodes:[],viaWays:['osm-way-123'],conditional:'Mo-Fr',except:'bus'},
  {...relation,viaNodes:['a','b'],viaWays:[],applicability:'verified'},
  {...relation,viaNodes:['a'],viaWays:[],applicability:'verified'}
 ]);
 assert.equal(r.independentFlags.viaWay,1);
 assert.equal(r.independentFlags.missingViaNode,1);
 assert.equal(r.independentFlags.multipleViaNodes,1);
 assert.equal(r.independentFlags.conditional,1);
 assert.equal(r.independentFlags.except,1);
 assert.equal(r.independentFlags.unverifiedApplicability,1);
 assert.equal(r.counts.complex,2);
 assert.equal(r.counts.verifiedSimple,1);
 assert.equal(r.allRestrictionsReady,false);
});

test('real Atlas unusual records remain excluded from automatic enforcement',()=>{
 // v493 records inspected read-only 12 Nov 2026. One via-way with empty
 // restriction; one time-conditional no-right-turn with empty base tag.
 const unusual=[
  {restrictionId:'osm-relation-15702066',fromWay:'osm-way-251290736',
   toWay:'osm-way-941597500',viaNodes:[],
   viaWays:['osm-way-941597502','osm-way-941597499'],
   restriction:'',conditional:'',except:'',applicability:'unverified'},
  {restrictionId:'osm-relation-15951715',fromWay:'osm-way-1179663427',
   toWay:'osm-way-1179663405',viaNodes:['2084225783'],viaWays:[],
   restriction:'',conditional:'no_right_turn @ (Sa;Su;Mo-Fr 00:00-07:00,09:00-24:00)',
   except:'',applicability:'requires-conditional-evaluation'}
 ];
 const r=classifyTurnEnforcement(unusual);
 assert.equal(r.independentFlags.unknownRestriction,2);
 assert.equal(r.independentFlags.viaWay,1);
 assert.equal(r.independentFlags.conditional,1);
 assert.equal(r.counts.complex,2);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('verified relation with malformed OSM way or blank via-node identity is blocked',()=>{
 const bad=[
  {...relation,applicability:'verified',fromWay:''},
  {...relation,applicability:'verified',toWay:'not-an-osm-way'},
  {...relation,applicability:'verified',viaNodes:['  ']}
 ];
 const r=classifyTurnEnforcement(bad);
 assert.equal(r.counts.malformed,3);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('unsafe numeric via-node identifier is rejected instead of rounded',()=>{
 const r=classifyTurnEnforcement([{...relation,applicability:'verified',
  viaNodes:[Number.MAX_SAFE_INTEGER+2]}]);
 assert.equal(r.counts.malformed,1);
 assert.equal(r.eligible.length,0);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('only_u_turn needs reversal-specific enforcement before it can be activated',()=>{
 const r=classifyTurnEnforcement([{...relation,applicability:'verified',
  fromWay:'osm-way-1339792254',toWay:'osm-way-1339792254',restriction:'only_u_turn'}]);
 assert.equal(r.counts.verifiedSimple,0);
 assert.equal(r.counts.complex,1);
 assert.equal(r.independentFlags.unknownRestriction,1);
 assert.equal(r.allRestrictionsReady,false);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('unknown restriction labels cannot claim full enforcement coverage',()=>{
 const r=classifyTurnEnforcement(['no_entry','only_custom_turn'].map(restriction=>
  ({...relation,applicability:'verified',restriction})));
 assert.equal(r.counts.complex,2);
 assert.equal(r.independentFlags.unknownRestriction,2);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
});

test('zero-padded OSM way aliases cannot become verified turn rules',()=>{
 const aliases=[
  {...relation,applicability:'verified',fromWay:'osm-way-01339792254'},
  {...relation,applicability:'verified',toWay:'osm-way-0607581032'},
  {...relation,applicability:'verified',fromWay:'osm-way-0'}
 ];
 const r=classifyTurnEnforcement(aliases);
 assert.equal(r.counts.malformed,3);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('padded via-node identities never qualify as verified turn restrictions',()=>{
 const aliases=['5757831665 ',' 5757831665','v ','\t5757831665'];
 const r=classifyTurnEnforcement(aliases.map(viaNode=>
  ({...relation,applicability:'verified',viaNodes:[viaNode]})));
 assert.equal(r.counts.malformed,aliases.length);
 assert.equal(r.eligible.length,0);
 assert.equal(r.allRestrictionsReady,false);
});
test('noncanonical numeric via-node aliases and nonpositive numbers fail closed',()=>{
 const aliases=['05757831665','0','+5757831665','-1',0,-1];
 const r=classifyTurnEnforcement(aliases.map(viaNode=>
  ({...relation,applicability:'verified',viaNodes:[viaNode]})));
 assert.equal(r.counts.malformed,aliases.length);
 assert.equal(r.eligible.length,0);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('canonical numeric and symbolic via-node identities remain eligible for fixtures',()=>{
 const r=classifyTurnEnforcement([
  {...relation,applicability:'verified'},
  {...relation,restrictionId:'fixture-relation',applicability:'verified',viaNodes:['v']}
 ]);
 assert.equal(r.counts.verifiedSimple,2);
 assert.deepEqual(r.eligible.map(x=>x.viaNode),['5757831665','v']);
 assert.equal(r.allRestrictionsReady,true);
 assert.equal(r.productionRoutingAuthorized,false);
});
