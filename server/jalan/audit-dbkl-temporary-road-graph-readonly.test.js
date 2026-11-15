'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarise,NOTICE}=require('./audit-dbkl-temporary-road-graph-readonly');
const roads=[
 {roadId:'osm-way-11',name:'Jalan U Thant',oneway:false,nodeIds:['100','201','202']},
 {roadId:'osm-way-12',name:'Jalan Langgak Golf',oneway:true,nodeIds:['301','302','400']},
 {roadId:'osm-way-13',name:'Jalan Tun Razak',oneway:true,nodeIds:['100','400','500']},
 {roadId:'osm-way-14',name:'  jalan u  thant ',oneway:false,nodeIds:['202','501']},
 {roadId:'not-provenance',name:'Jalan Langgak Golf',oneway:false,nodeIds:['999']},
 {roadId:'osm-way-18',name:'Unrelated private road',oneway:false,nodeIds:['100']}
];
test('DBKL notice date, imported directed ways and shared nodes are advisory only',()=>{
 const r=summarise(roads,['osm-way-11:0:F','osm-way-11:1:F','osm-way-12:0:F',
  'osm-way-13:1:F','osm-way-18:0:F','garbage'], '2026-11-15');
 assert.equal(r.withinPublishedControlWindow,true);
 assert.equal(NOTICE.through,'2027-01-31');
 assert.deepEqual(r.namedRoads.map(x=>x.importedWays),[2,1,1]);
 assert.deepEqual(r.namedRoads.map(x=>x.importedDirectedEdges),[2,1,1]);
 assert.equal(r.namedRoads[1].onewayTrue,1);
 assert.equal(r.importedSharedNodeCandidates.uThantTunRazak,1);
 assert.equal(r.importedSharedNodeCandidates.langgakGolfTunRazak,1);
 assert.equal(r.currentSignsVerified,false);
 assert.equal(r.temporaryControlEnforcementAuthorized,false);
 assert.equal(r.turnRestrictionsEnforced,false);
 assert.equal(r.legalDrivingRouteVerified,false);
 assert.equal(r.databaseWrites,0);
 assert.equal(r.acceptedIndependentJourneys,0);
});
test('missing named roads and dates outside notice window do not become legal claims',()=>{
 const r=summarise([],[], '2027-02-01');
 assert.equal(r.withinPublishedControlWindow,false);
 assert.equal(r.namedRoadsWithoutExactImportedMatch.length,3);
 assert.equal(r.importedSharedNodeCandidates.uThantTunRazak,0);
 assert.equal(r.actualTomTomComparisonVerified,false);
 assert.equal(r.legalDrivingRouteVerified,false);
 assert.throws(()=>summarise({},[], '2026-11-15'));
 assert.throws(()=>summarise([],[], '2026/11/15'));
});

test('imported directed transfer candidates distinguish two DBKL closed movements without treating them as legal',()=>{
 const minimal=[
  {roadId:'osm-way-11',name:'Jalan U Thant',oneway:false,nodeIds:['201','100']},
  {roadId:'osm-way-12',name:'Jalan Langgak Golf',oneway:false,nodeIds:['301','400']},
  {roadId:'osm-way-13',name:'Jalan Tun Razak',oneway:true,nodeIds:['100','500','400']}
 ];
 const observed=[
  {edgeId:'osm-way-11:0:F',fromNode:'201',toNode:'100'},
  {edgeId:'osm-way-13:0:F',fromNode:'100',toNode:'500'},
  {edgeId:'osm-way-13:1:F',fromNode:'500',toNode:'400'},
  {edgeId:'osm-way-12:0:F',fromNode:'400',toNode:'301'},
  {edgeId:'osm-way-12:0:R',fromNode:'301',toNode:'400'},
  {edgeId:'osm-way-13:1:R',fromNode:'400',toNode:'500'}
 ];
 const r=summarise(minimal,observed,'2026-11-15');
 assert.equal(r.importedSharedNodeCandidates.uThantTunRazak,1);
 assert.equal(r.importedSharedNodeCandidates.langgakGolfTunRazak,1);
 const c=r.importedDirectionCandidates;
 assert.deepEqual(c.uThantToTunRazak.potentialDirectedTransferNodeIds,['100']);
 assert.deepEqual(c.tunRazakToLanggakGolf.potentialDirectedTransferNodeIds,['400']);
 assert.deepEqual(c.langgakGolfToTunRazak.potentialDirectedTransferNodeIds,['400']);
 for(const candidate of Object.values(c)){
  assert.equal(candidate.nodesWithPotentialDirectedTransfer,1);
  assert.equal(candidate.independentlyVerifiedLegalTurn,false);
 }
 assert.equal(r.legalDrivingRouteVerified,false);
 assert.equal(r.temporaryControlEnforcementAuthorized,false);
 assert.equal(r.databaseWrites,0);
 assert.equal(r.acceptedIndependentJourneys,0);
});
test('an identity-only or malformed endpoint scan cannot manufacture directed turn evidence',()=>{
 const minimal=[
  {roadId:'osm-way-11',name:'Jalan U Thant',nodeIds:['100','201']},
  {roadId:'osm-way-13',name:'Jalan Tun Razak',nodeIds:['100','500']}
 ];
 const r=summarise(minimal,[
  'osm-way-11:0:F',
  {edgeId:'osm-way-13:0:F',fromNode:'100',toNode:'not-osm-id'},
  {edgeId:'osm-way-13:1:F',fromNode:'999',toNode:'500'}
 ],'2026-11-15');
 assert.equal(r.importedDirectionCandidates.uThantToTunRazak.sharedNodeCount,1);
 assert.deepEqual(r.importedDirectionCandidates.uThantToTunRazak.sharedImportedNodeIds,['100']);
 assert.equal(r.importedDirectionCandidates.uThantToTunRazak.nodesWithPotentialDirectedTransfer,0);
 assert.equal(r.importedDirectionCandidates.uThantToTunRazak.independentlyVerifiedLegalTurn,false);
});
