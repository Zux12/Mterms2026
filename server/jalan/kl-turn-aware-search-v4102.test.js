'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {searchTurnAware}=require('./kl-turn-aware-search-v4102');
const base={restrictionId:'osm-relation-10341546',fromWay:'osm-way-1339792254',
 toWay:'osm-way-607581032',viaNodes:['v'],viaWays:[],restriction:'no_right_turn',
 applicability:'verified',conditional:'',except:''};
const e=(id,from,to,len)=>({id,from,to,len});
function graph(edges){const adj=new Map();for(const x of edges){if(!adj.has(x.from))adj.set(x.from,[]);adj.get(x.from).push(x);}return {adj};}
const a=e('osm-way-1339792254:9:F','s','v',10);
const banned=e('osm-way-607581032:0:F','v','t',10);
const detour=e('osm-way-111111:0:F','v','x',15);
const returnEdge=e('osm-way-222222:0:F','x','t',15);
test('verified no-right-turn forces a directed detour rather than shortest banned turn',()=>{
 const r=searchTurnAware(graph([a,banned,detour,returnEdge]),'s','t',[base]);
 assert.equal(r.ok,true);assert.equal(r.distanceMeters,40);
 assert.deepEqual(r.pathEdgeIds,[a.id,detour.id,returnEdge.id]);
 assert.equal(r.turnRestrictionsEnforced,true);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('unverified imported turn restrictions fail closed, not silently ignored',()=>{
 const r=searchTurnAware(graph([a,banned]),'s','t',[{...base,applicability:'unverified'}]);
 assert.equal(r.ok,false);assert.equal(r.reason,'turn-restrictions-not-fully-verified');
});
test('verified only-turn blocks all other exits from restricted via-node',()=>{
 const r=searchTurnAware(graph([a,banned,detour,returnEdge]),'s','t',
  [{...base,restriction:'only_right_turn'}]);
 assert.equal(r.ok,true);assert.deepEqual(r.pathEdgeIds,[a.id,banned.id]);
});
test('verified prohibited turn without detour returns explicit no compliant path',()=>{
 const r=searchTurnAware(graph([a,banned]),'s','t',[base]);
 assert.equal(r.ok,false);assert.equal(r.reason,'no-turn-compliant-path');
});
test('conditional and via-way restrictions never activate prototype',()=>{
 for(const relation of [{...base,conditional:'Mo-Fr 08:00-09:00'},
   {...base,viaNodes:[],viaWays:['osm-way-111111']}])
  assert.equal(searchTurnAware(graph([a,banned]),'s','t',[relation]).reason,
   'turn-restrictions-not-fully-verified');
});

test('real imported KL via-node relation redirects across actual directed OSM edges',()=>{
 // Atlas v493/v495 12 Nov 2026: genuine node IDs and edge identities.
 // Detour legs are fixture-only; real alternate-route availability remains unverified.
 const incoming=e('osm-way-1339792254:9:F','2911228074','5757831665',50);
 const restricted=e('osm-way-607581032:0:F','5757831665','5757831664',10);
 const alternate=e('osm-way-999991:0:F','5757831665','fixture-detour',20);
 const finish=e('osm-way-999992:0:F','fixture-detour','5757831664',20);
 const relation={...base,viaNodes:['5757831665']};
 const result=searchTurnAware(graph([incoming,restricted,alternate,finish]),
  '2911228074','5757831664',[relation]);
 assert.equal(result.ok,true);
 assert.deepEqual(result.pathEdgeIds,[incoming.id,alternate.id,finish.id]);
 assert.equal(result.distanceMeters,90);
});

test('empty restriction input cannot claim turn-compliant route coverage',()=>{
 const r=searchTurnAware(graph([a,banned]),'s','t',[]);
 assert.equal(r.ok,false);
 assert.equal(r.reason,'no-verified-turn-restriction-coverage');
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('same-node route with verified rules is zero length and not production approved',()=>{
 const r=searchTurnAware(graph([a,banned]),'s','s',[base]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[]);
 assert.equal(r.distanceMeters,0);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('no-u-turn allows forward continuation on same OSM way but blocks reversal',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const forward=e('osm-way-1339792254:1:F','v','t',10);
 const reverse=e('osm-way-1339792254:0:R','v','s',10);
 const restriction={...base,toWay:base.fromWay,restriction:'no_u_turn'};
 const result=searchTurnAware(graph([incoming,forward,reverse]),'s','t',[restriction]);
 assert.equal(result.ok,true);
 assert.deepEqual(result.pathEdgeIds,[incoming.id,forward.id]);
 assert.equal(result.productionRoutingAuthorized,false);
});
test('no-u-turn prohibits immediate reverse transition at restricted junction',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const reverse=e('osm-way-1339792254:0:R','v','s',10);
 const restriction={...base,toWay:base.fromWay,restriction:'no_u_turn'};
 // With a different start, the shortest return to s must not reverse at v.
 const result=searchTurnAware(graph([incoming,reverse]),'s','missing',[restriction]);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'no-turn-compliant-path');
});

test('turn restrictions apply only to matching incoming OSM way at the junction',()=>{
 const otherIncoming=e('osm-way-777777:0:F','s','v',10);
 const otherwiseRestricted=e('osm-way-607581032:0:F','v','t',10);
 const r=searchTurnAware(graph([otherIncoming,otherwiseRestricted]),'s','t',[base]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[otherIncoming.id,otherwiseRestricted.id]);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('multiple verified restrictions at one junction all apply before selecting a detour',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const first=e('osm-way-607581032:0:F','v','t',10);
 const second=e('osm-way-888888:0:F','v','t',12);
 const allowed=e('osm-way-999999:0:F','v','x',15);
 const finish=e('osm-way-444444:0:F','x','t',15);
 const rules=[base,{...base,restrictionId:'osm-relation-10341547',toWay:'osm-way-888888'}];
 const r=searchTurnAware(graph([incoming,first,second,allowed,finish]),'s','t',rules);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,allowed.id,finish.id]);
 assert.equal(r.distanceMeters,40);
 assert.equal(r.productionRoutingAuthorized,false);
});
