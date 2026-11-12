'use strict';
// Offline HTTP-contract tests. No Atlas connection, secret or network calls.
const test=require('node:test');
const assert=require('node:assert/strict');
const {previewDenied,previewHealthVerified,previewRouteVerified}=require('./smoke-kl-preview-local');

function response(status=200,headers={'cache-control':'no-store'}) {
 return {status,headers:new Headers(headers)};
}
const denied={ok:false,error:'Preview token required'};
const health={ok:true,readOnly:true,liveRouting:false,graphEdges:168221};
const route={
 ok:true,mode:'EXPERIMENTAL_SEGMENT_ROUTE',graphEdges:168221,
 graphVersion:'road_graph_edges_v495',routingActivated:false,
 legalDrivingRouteVerified:false,accessRestrictionsEnforced:false,
 turnRestrictionsEnforced:false,trafficAware:false,databaseWrites:0,
 geometry:{type:'LineString',coordinates:[[101.7038508,3.1315707],
  [101.70382,3.13153],[101.7038951,3.1314573]]},
 startSnapMeters:0,endSnapMeters:0,
 geometryGapReviewAvailable:true,geometryGapCountOverThreshold:0,
 geometryGapThresholdMeters:2,geometryGapTransitionsInspected:0,
 geometryMaxGapMeters:0,geometryGapAdvisoryOnly:true,edgeCount:1,distanceMeters:17
};
test('health and route need hardened headers and exact expected KL graph',()=>{
 assert.equal(previewHealthVerified(response(),health),true);
 assert.equal(previewRouteVerified(response(),route),true);
 for(const h of [{},{'cache-control':'public, max-age=300'},
  {'cache-control':'no-store','x-powered-by':'Express'}]){
  assert.equal(previewHealthVerified(response(200,h),health),false);
  assert.equal(previewRouteVerified(response(200,h),route),false);
 }
 assert.equal(previewHealthVerified(response(),{...health,graphEdges:12}),false);
 assert.equal(previewRouteVerified(response(),{...route,graphVersion:'other'}),false);
 assert.equal(previewRouteVerified(response(),{...route,graphEdges:12}),false);
});
test('unauthenticated health and route must return the expected denial contract',()=>{
 assert.equal(previewDenied(response(401),denied),true);
 assert.equal(previewDenied(response(200),denied),false);
 assert.equal(previewDenied(response(401),{ok:true,error:'Preview token required'}),false);
 assert.equal(previewDenied(response(401),{ok:false,error:'other'}),false);
 assert.equal(previewDenied(response(401,{'cache-control':'public'}),denied),false);
});
test('route smoke rejects unsafe claims and nonexperimental responses',()=>{
 for(const k of ['routingActivated','legalDrivingRouteVerified',
  'accessRestrictionsEnforced','turnRestrictionsEnforced','trafficAware']){
  assert.equal(previewRouteVerified(response(),{...route,[k]:true}),false,k);
 }
 assert.equal(previewRouteVerified(response(),{...route,databaseWrites:1}),false);
 assert.equal(previewRouteVerified(response(),{...route,mode:'LIVE_ROUTING'}),false);
 assert.equal(previewRouteVerified(response(404),route),false);
});
test('route smoke rejects malformed GeoJSON, illegal coordinates and false distance',()=>{
 for(const geometry of [
  null,{type:'Point',coordinates:[[101,3],[101.1,3.1]]},
  {type:'LineString',coordinates:[[101,3]]},
  {type:'LineString',coordinates:[[101,3],[181,3]]},
  {type:'LineString',coordinates:[[101,3],['secret',3]]},
  {type:'LineString',coordinates:[[101,3],[101,NaN]]}
 ]) assert.equal(previewRouteVerified(response(),{...route,geometry}),false);
 assert.equal(previewRouteVerified(response(),{...route,distanceMeters:0}),false);
});

const publicJourney={startLat:3.1315707,startLng:101.7038508,
 endLat:3.1314573,endLng:101.7038951};
test('HTTP smoke accepts independently consistent public OSM route geometry',()=>{
 assert.equal(previewRouteVerified(response(),route,publicJourney),true);
});
test('HTTP smoke rejects displaced or shortened geometry despite plausible 17m claim',()=>{
 const displaced={...route,geometry:{...route.geometry,coordinates:
  route.geometry.coordinates.map(([lng,lat])=>[lng,lat+0.002])}};
 const shortened={...route,geometry:{...route.geometry,coordinates:
  [route.geometry.coordinates[0],route.geometry.coordinates[2]]}};
 assert.equal(previewRouteVerified(response(),displaced,publicJourney),false);
 assert.equal(previewRouteVerified(response(),shortened,publicJourney),false);
 assert.equal(previewRouteVerified(response(),route,{...publicJourney,endLat:3.133}),false);
});
test('HTTP smoke rejects missing, falsified or unreviewed snap and geometry metrics',()=>{
 for(const changed of [
  {startSnapMeters:undefined},{endSnapMeters:200},
  {endSnapMeters:'0'},{geometryGapReviewAvailable:false},
  {geometryGapCountOverThreshold:1},{geometryGapThresholdMeters:5}
 ])assert.equal(previewRouteVerified(response(),{...route,...changed},publicJourney),false);
});

test('HTTP smoke rejects a relocated OSM-node journey despite internally consistent snap distances',()=>{
 // Translate both endpoints ~11 m; the generic collector allows a 200 m
 // candidate, but this particular smoke must actually exercise the node.
 const relocated={...route,startSnapMeters:11,endSnapMeters:11,
  geometry:{...route.geometry,coordinates:
   route.geometry.coordinates.map(([lng,lat])=>[lng,lat+0.0001])}};
 const {geometryMatchesJourney}=require('./collect-kl-route-evidence');
 assert.equal(geometryMatchesJourney(relocated,publicJourney),true);
 assert.equal(previewRouteVerified(response(),relocated,publicJourney),false);
});
test('HTTP smoke requires complete and internally consistent geometry gap audit',()=>{
 for(const changed of [
  {geometryGapAdvisoryOnly:false},
  {geometryGapTransitionsInspected:undefined},
  {geometryGapTransitionsInspected:-1},
  {geometryGapThresholdMeters:-1},
  {geometryMaxGapMeters:undefined},
  {geometryMaxGapMeters:-0.1},
  {geometryMaxGapMeters:3}
 ])assert.equal(previewRouteVerified(response(),{...route,...changed},publicJourney),false,
  JSON.stringify(changed));
});

test('HTTP smoke requires gap transitions to cover every routed edge boundary',()=>{
 for(const changed of [
  {edgeCount:undefined},{edgeCount:2},{edgeCount:0},
  {geometryGapTransitionsInspected:2}
 ])assert.equal(previewRouteVerified(response(),{...route,...changed},publicJourney),false,
  JSON.stringify(changed));
 assert.equal(previewRouteVerified(response(),{
  ...route,edgeCount:3,geometryGapTransitionsInspected:2
 },publicJourney),true);
});
