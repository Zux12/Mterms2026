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
