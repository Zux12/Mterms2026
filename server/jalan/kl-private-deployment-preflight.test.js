'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {preflight}=require('./kl-private-deployment-preflight');
test('incomplete deployment checklist fails closed',()=>{
 const r=preflight({separateService:true,previewMode:'EXPERIMENTAL_SEGMENT_ROUTE'});
 assert.equal(r.ready,false);
 assert.equal(r.productionRoutingAuthorized,false);
 assert.ok(r.issues.some(x=>x.includes('readOnlyDatabase')));
});
test('all declared private pilot gates can pass without authorizing public navigation',()=>{
 const config={};
 for(const key of ['separateService','separateCredentials','readOnlyDatabase','httpsOnly',
  'privatePageAuthentication','privateApiAuthentication','secretsManager',
  'requestRateLimits','routeConcurrencyLimit','noCoordinateLogging',
  'healthAndFailureHandling','externalPilotDiagnosticOnly'])config[key]=true;
 Object.assign(config,{productionServiceModified:false,turnRestrictionsEnforced:false,
  publicDrivingDirectionsEnabled:false,databaseWritesEnabled:false,
  previewMode:'EXPERIMENTAL_SEGMENT_ROUTE'});
 const r=preflight(config);
 assert.equal(r.ready,true);
 assert.equal(r.productionRoutingAuthorized,false);
 assert.equal(r.externalDrivingNavigationAuthorized,false);
});
