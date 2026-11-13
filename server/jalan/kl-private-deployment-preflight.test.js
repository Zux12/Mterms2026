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

test('private Heroku deployment enforces post-deployment authenticated smoke',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git HEAD:refs/heads/main');
 const anonymous=yaml.indexOf('Verify canonical private pilot URL rejects anonymous visitors');
 const authenticated=yaml.indexOf('Verify authenticated private pilot after deployed revision');
 assert.ok(push>0,'Heroku deployment command must exist');
 assert.ok(anonymous>push,'anonymous access must be blocked after deployment');
 assert.ok(authenticated>anonymous,'authenticated verification must follow deployment and privacy probe');
 assert.ok(yaml.slice(authenticated).includes('run: node server/jalan/smoke-heroku-private-pilot.js'),
  'run existing read-only authenticated route and health smoke post-deploy');
 assert.ok(yaml.includes("if: github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"),
  'deployment must remain gated to established trusted branch');
});

test('pilot deployment attributes authenticated smoke to a newer succeeded Heroku release',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const before=yaml.indexOf('Record pre-push Heroku release baseline (non-secret)');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git HEAD:refs/heads/main');
 const privacy=yaml.indexOf('Verify canonical private pilot URL rejects anonymous visitors');
 const verify=yaml.indexOf('Confirm newer successful Heroku release (read-only)');
 const auth=yaml.indexOf('Verify authenticated private pilot after deployed revision');
 assert.ok(before>0&&before<push);
 assert.ok(privacy>push&&verify>privacy&&auth>verify);
 assert.ok(yaml.includes('latest.version>base.version&&latest.id!==base.id'));
 assert.ok(yaml.includes("latest.status==='succeeded'"));
 assert.ok(yaml.includes("github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"));
});
