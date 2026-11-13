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

test('only-turn restriction at junction permits the named outgoing way but not shorter alternative',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const required=e('osm-way-607581032:0:F','v','t',20);
 const shortcut=e('osm-way-999999:0:F','v','t',1);
 const rule={...base,restriction:'only_right_turn'};
 const r=searchTurnAware(graph([incoming,required,shortcut]),'s','t',[rule]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,required.id]);
 assert.equal(r.distanceMeters,30);
});
test('only-turn restriction does not affect vehicles arriving from another road',()=>{
 const incoming=e('osm-way-888888:0:F','s','v',10);
 const shortcut=e('osm-way-999999:0:F','v','t',1);
 const required=e('osm-way-607581032:0:F','v','t',20);
 const rule={...base,restriction:'only_right_turn'};
 const r=searchTurnAware(graph([incoming,required,shortcut]),'s','t',[rule]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,shortcut.id]);
 assert.equal(r.distanceMeters,11);
});

test('turn-aware search refuses an adjacency edge whose origin does not match its node bucket',()=>{
 const wrong={...a,from:'unrelated-node'};
 const g={adj:new Map([['s',[wrong]],['v',[banned]]])};
 assert.throws(()=>searchTurnAware(g,'s','t',[base]),/Invalid graph edge/);
});
test('turn-aware search rejects missing OSM identity even on a one-edge route',()=>{
 const anonymous=e('unattributed-edge','s','t',12);
 assert.throws(()=>searchTurnAware(graph([anonymous]),'s','t',[base]),
  /Missing OSM way identity/);
});
test('turn-aware search refuses finite edge costs that overflow accumulated route distance',()=>{
 const large=e('osm-way-777777:0:F','s','v',1e308);
 const more=e('osm-way-888888:0:F','v','t',1e308);
 assert.throws(()=>searchTurnAware(graph([large,more]),'s','t',[base]),
  /Invalid accumulated turn-aware route cost/);
});
test('heap frontier preserves globally shortest detour despite expensive first branch',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',1);
 const banned=e('osm-way-607581032:0:F','v','t',1);
 const expensive=e('osm-way-999999:0:F','v','a',100);
 const cheap=e('osm-way-888888:0:F','v','b',2);
 const cheapFinish=e('osm-way-777777:0:F','b','t',2);
 const expensiveFinish=e('osm-way-666666:0:F','a','t',1);
 const r=searchTurnAware(graph([incoming,banned,expensive,cheap,cheapFinish,expensiveFinish]),'s','t',[base]);
 assert.equal(r.ok,true);
 assert.equal(r.distanceMeters,5);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,cheap.id,cheapFinish.id]);
});
test('heap frontier handles 2000 directed edges and preserves shortest distance',()=>{
 const edges=[];
 for(let i=0;i<2000;i++)edges.push(e('osm-way-'+(900000+i)+':0:F','n'+i,'n'+(i+1),1));
 const r=searchTurnAware(graph(edges),'n0','n2000',[base]);
 assert.equal(r.ok,true);
 assert.equal(r.distanceMeters,2000);
 assert.equal(r.pathEdgeIds.length,2000);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('only_u_turn must not treat forward continuation as a legal U-turn',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const forward=e('osm-way-1339792254:1:F','v','t',10);
 const reverse=e('osm-way-1339792254:0:R','v','s',10);
 const restriction={...base,toWay:base.fromWay,restriction:'only_u_turn'};
 const r=searchTurnAware(graph([incoming,forward,reverse]),'s','t',[restriction]);
 assert.equal(r.ok,false);
 assert.equal(r.reason,'turn-restrictions-not-fully-verified');
 assert.equal(r.productionRoutingAuthorized,false);
});

test('a forged incoming roadId cannot evade a verified turn prohibition',()=>{
 const spoofed={...a,roadId:'osm-way-999999'};
 assert.throws(()=>searchTurnAware(graph([spoofed,banned]),'s','t',[base]),
  /Conflicting OSM way identity/);
});
test('a forged outgoing roadId cannot evade a verified turn prohibition',()=>{
 const spoofed={...banned,roadId:'osm-way-999999'};
 assert.throws(()=>searchTurnAware(graph([a,spoofed]),'s','t',[base]),
  /Conflicting OSM way identity/);
});
test('a noncanonical directed edge ID cannot be laundered through roadId',()=>{
 const spoofed={...banned,id:'custom-road-edge',roadId:base.toWay};
 assert.throws(()=>searchTurnAware(graph([a,spoofed]),'s','t',[base]),
  /Missing OSM way identity/);
});
test('matching roadId metadata preserves an allowed detour',()=>{
 const edges=[a,banned,detour,returnEdge].map(edge=>({
  ...edge,roadId:edge.id.split(':')[0]
 }));
 const r=searchTurnAware(graph(edges),'s','t',[base]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[a.id,detour.id,returnEdge.id]);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('zero-padded incoming OSM way identity cannot evade an enforced turn rule',()=>{
 const alias={...a,id:'osm-way-01339792254:9:F'};
 assert.throws(()=>searchTurnAware(graph([alias,banned]),'s','t',[base]),
  /Missing OSM way identity/);
});
test('zero-padded outgoing OSM way identity cannot evade an enforced turn rule',()=>{
 const alias={...banned,id:'osm-way-0607581032:0:F'};
 assert.throws(()=>searchTurnAware(graph([a,alias]),'s','t',[base]),
  /Missing OSM way identity/);
});
test('zero-padded edge segment index is rejected before route acceptance',()=>{
 const alias={...banned,id:'osm-way-607581032:00:F'};
 assert.throws(()=>searchTurnAware(graph([a,alias]),'s','t',[base]),
  /Missing OSM way identity/);
});

test('a padded via-node restriction cannot silently authorize a banned direct turn',()=>{
 const relation={...base,viaNodes:['v '],applicability:'verified'};
 const r=searchTurnAware(graph([a,banned]),'s','t',[relation]);
 assert.equal(r.ok,false);
 assert.equal(r.reason,'turn-restrictions-not-fully-verified');
 assert.equal(r.productionRoutingAuthorized,false);
});

function onlyTurnReversalTrap(restriction){
 // Entry from another way is barred from taking the exit directly. Without
 // reversal enforcement, the search can return to 's' under a new incoming
 // identity and incorrectly escape by making an immediate U-turn at 'v'.
 const entering=e('osm-way-111111:0:F','q','s',2);
 const incoming=e('osm-way-1339792254:0:F','s','v',3);
 const reverse=e('osm-way-1339792254:0:R','v','s',3);
 const exit=e('osm-way-444444:0:F','s','target',2);
 const entryRule={...base,restrictionId:'fixture-entry-block',
  fromWay:'osm-way-111111',toWay:'osm-way-444444',viaNodes:['s']};
 const onlyRule={...base,restrictionId:'fixture-only-rule',
  toWay:base.fromWay,viaNodes:['v'],restriction};
 return searchTurnAware(graph([entering,incoming,reverse,exit]),
  'q','target',[entryRule,onlyRule]);
}
test('only_straight_on cannot be satisfied by reversing along the same OSM way',()=>{
 const r=onlyTurnReversalTrap('only_straight_on');
 assert.equal(r.ok,false);
 assert.equal(r.reason,'no-turn-compliant-path');
 assert.equal(r.productionRoutingAuthorized,false);
});
test('only_left_turn and only_right_turn also reject immediate reversal aliases',()=>{
 for(const label of ['only_left_turn','only_right_turn']){
  const r=onlyTurnReversalTrap(label);
  assert.equal(r.ok,false,label);
  assert.equal(r.reason,'no-turn-compliant-path',label);
  assert.equal(r.productionRoutingAuthorized,false,label);
 }
});
test('same-way forward travel remains permitted under verified only_straight_on',()=>{
 const incoming=e('osm-way-1339792254:0:F','s','v',10);
 const forward=e('osm-way-1339792254:1:F','v','t',10);
 const reverse=e('osm-way-1339792254:0:R','v','s',1);
 const rule={...base,toWay:base.fromWay,restriction:'only_straight_on'};
 const r=searchTurnAware(graph([incoming,reverse,forward]),'s','t',[rule]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,forward.id]);
 assert.equal(r.distanceMeters,20);
 assert.equal(r.productionRoutingAuthorized,false);
});


test('zero-padded imported graph junction ID cannot bypass a verified no-turn rule',()=>{
 const incoming=e('osm-way-1339792254:9:F','2911228074','05757831665',10);
 const outgoing=e('osm-way-607581032:0:F','05757831665','5757831664',10);
 const relation={...base,viaNodes:['5757831665']};
 assert.throws(()=>searchTurnAware(graph([incoming,outgoing]),'2911228074','5757831664',[relation]),
  /Invalid graph edge/);
});
test('whitespace-padded symbolic graph junction ID cannot bypass a verified rule',()=>{
 const incoming=e('osm-way-1339792254:9:F','s','v ',10);
 const outgoing=e('osm-way-607581032:0:F','v ','t',10);
 assert.throws(()=>searchTurnAware(graph([incoming,outgoing]),'s','t',[base]),
  /Invalid graph edge/);
});
test('noncanonical graph route endpoint is rejected before a zero-length or direct route',()=>{
 const incoming=e('osm-way-1339792254:0:F','05757831665','t',10);
 assert.throws(()=>searchTurnAware(graph([incoming]),'05757831665','t',[base]),
  /Directed adjacency and node IDs required/);
});
test('canonical numeric junction IDs still enforce the verified no-turn detour',()=>{
 const incoming=e('osm-way-1339792254:9:F','2911228074','5757831665',10);
 const banned=e('osm-way-607581032:0:F','5757831665','5757831664',2);
 const detour=e('osm-way-999991:0:F','5757831665','x',7);
 const finish=e('osm-way-999992:0:F','x','5757831664',8);
 const relation={...base,viaNodes:['5757831665']};
 const r=searchTurnAware(graph([incoming,banned,detour,finish]),
  '2911228074','5757831664',[relation]);
 assert.equal(r.ok,true);
 assert.deepEqual(r.pathEdgeIds,[incoming.id,detour.id,finish.id]);
 assert.equal(r.distanceMeters,25);
 assert.equal(r.productionRoutingAuthorized,false);
});

test('reused directed edge ID in another junction fails even when a shorter route returns first',()=>{
 const good=e('osm-way-999999:0:F','s','t',2);
 const collision=e('osm-way-999999:0:F','unrelated','elsewhere',3);
 assert.throws(()=>searchTurnAware(graph([good,collision]),'s','t',[base]),
  /Duplicate graph edge identity/);
});
test('two identical adjacency entries cannot share a directed edge-state key',()=>{
 const direct=e('osm-way-999999:0:F','s','t',2);
 assert.throws(()=>searchTurnAware(graph([direct,direct]),'s','t',[base]),
  /Duplicate graph edge identity/);
});
test('unreachable invalid edge cannot be hidden behind an accepted turn-aware route',()=>{
 const direct=e('osm-way-999999:0:F','s','t',2);
 const invalid=e('osm-way-0999999:0:F','elsewhere','far-away',3);
 assert.throws(()=>searchTurnAware(graph([direct,invalid]),'s','t',[base]),
  /Missing OSM way identity/);
});
test('distinct segment identities of the same OSM way remain valid directed edges',()=>{
 const first=e('osm-way-999999:0:F','s','v',2);
 const second=e('osm-way-999999:1:F','v','t',3);
 const r=searchTurnAware(graph([first,second]),'s','t',[base]);
 assert.equal(r.ok,true);
 assert.equal(r.distanceMeters,5);
 assert.deepEqual(r.pathEdgeIds,[first.id,second.id]);
 assert.equal(r.productionRoutingAuthorized,false);
});
