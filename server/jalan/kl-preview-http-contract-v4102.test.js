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
 geometry:{type:'LineString',coordinates:[[101.70385,3.13157],[101.70389,3.13146]]},
 distanceMeters:17
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
