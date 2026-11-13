'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {reviewEndpoint}=require('./kl-endpoint-evidence-v4102');
const valid={nodeId:'5738558701',importedClass:'source-only',incoming:0,outgoing:3,
 parentWayIds:['123456'],evidenceSource:'https://www.openstreetmap.org/way/123456',
 evidenceRetrievedAt:'2026-11-11T09:00:00Z',classification:'unresolved',
 reason:'Independent map review cannot yet establish the driving direction.'};
test('complete unresolved evidence is recorded without legal clearance',()=>{
 const r=reviewEndpoint(valid);assert.equal(r.accepted,true);assert.equal(r.roadLegalityVerified,false);
 assert.equal(r.productionRoutingAuthorized,false);
});
test('bare imported endpoint counts cannot be marked reviewed',()=>{
 const r=reviewEndpoint({nodeId:valid.nodeId,importedClass:'source-only',incoming:0,outgoing:3});
 assert.equal(r.accepted,false);assert.ok(r.errors.length>=4);
});
test('source-only endpoint must have zero incoming edges',()=>{
 assert.equal(reviewEndpoint({...valid,incoming:1}).accepted,false);
});
test('sink-only endpoint must have zero outgoing edges',()=>{
 assert.equal(reviewEndpoint({...valid,importedClass:'sink-only',incoming:2,outgoing:1}).accepted,false);
});
test('suspected import gap requires corroboration',()=>{
 const r=reviewEndpoint({...valid,classification:'suspected-import-gap'});
 assert.equal(r.accepted,false);assert.ok(r.errors.some(e=>e.includes('second independent')));
});
test('corroborated candidate still never authorizes routing',()=>{
 const r=reviewEndpoint({...valid,classification:'suspected-import-gap',confirmationSource:'https://example.org/independent-map'});
 assert.equal(r.accepted,true);assert.equal(r.productionRoutingAuthorized,false);
});

test('metadata-only source URL never claims independent verification',()=>{
 const r=reviewEndpoint(valid);
 assert.equal(r.evidenceStatus,'metadata-complete-unverified');
 assert.equal(r.independentSourceFetched,false);
 assert.equal(r.roadLegalityVerified,false);
});
test('incomplete endpoint evidence is explicitly unknown',()=>{
 const r=reviewEndpoint({...valid,parentWayIds:[]});
 assert.equal(r.evidenceStatus,'incomplete');
 assert.equal(r.independentSourceFetched,false);
});
