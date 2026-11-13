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

test('private pilot release gate distinguishes new code slug from config-only release',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 assert.ok(yaml.includes('slugId:latest.slug.id'),
  'pre-push baseline must record code slug identity');
 assert.ok(yaml.includes('latest.slug.id!==base.slugId'),
  'post-push release must point to a different code slug');
 assert.ok(yaml.includes("latest.status==='succeeded'"),
  'changed code release must also have succeeded');
 assert.ok(yaml.includes("if: github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"),
  'deployment secrets remain restricted to the trusted branch');
});

test('merging routing safeguards cannot automatically deploy the Heroku pilot',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const triggers=yaml.split('permissions:')[0];
 assert.match(triggers,/on:\s*\n\s*workflow_dispatch:/);
 assert.doesNotMatch(triggers,/\n\s*push:/,
  'private pilot deployment must not be triggered by merge or push');
 assert.ok(yaml.includes("if: github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"),
  'manual deployment remains locked to trusted branch');
 assert.ok(yaml.includes('Verify authenticated private pilot after deployed revision'),
  'manual deployment must retain postdeploy private route verification');
});

test('trusted routing regression cannot automatically provision Heroku pilot',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-routing-tests.yml'),'utf8');
 assert.doesNotMatch(yaml,/^  heroku-provision-pilot:/m,
  'routing regression must not run a mutating provisioning job');
 assert.doesNotMatch(yaml,/run: node server\/jalan\/provision-heroku-pilot\.js/,
  'existing pilot must not be re-provisioned by test workflow');
 assert.match(yaml,/^  heroku-readonly:/m);
 assert.match(yaml,/^  heroku-runtime:/m);
 assert.match(yaml,/^  heroku-authenticated-pilot:/m);
});

test('private pilot deployment verifies the actual pushed Git SHA against Heroku slug metadata',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const commit=yaml.indexOf("git -c user.name='JALAN Pilot CI'");
 const expected=yaml.indexOf('git rev-parse HEAD > "$RUNNER_TEMP/jalan-expected-heroku-commit"');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git HEAD:refs/heads/main');
 const metadata=yaml.indexOf('/slugs/');
 const auth=yaml.indexOf('Verify authenticated private pilot after deployed revision');
 assert.ok(commit>0&&expected>commit&&push>expected);
 assert.ok(metadata>push&&auth>metadata,'slug provenance must precede authenticated route smoke');
 assert.ok(yaml.includes('slug.commit!==expected'),'mismatch must fail closed');
 assert.ok(yaml.includes('jalan-expected-heroku-commit"'),
  'temporary expected SHA must be included in cleanup');
});
