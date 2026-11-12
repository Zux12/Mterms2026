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
