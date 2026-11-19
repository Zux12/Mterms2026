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

test('manual Heroku dispatch defaults to read-only and requires an explicit live-release phrase',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const dispatch=yaml.split('permissions:')[0];
 assert.match(dispatch,/validation_only:\n(?:[^\n]*\n){0,5}\s*default: true\n/,
  'default dispatch must not deploy private code');
 assert.match(dispatch,/release_approval:\n(?:[^\n]*\n){0,6}\s*type: string/,
  'manual live release must expose a separate explicit operator approval input');
 const approval=yaml.indexOf('BLOCK private code release unless operator typed explicit deployment approval');
 const privacy=yaml.indexOf('BLOCK manual code deployment unless dedicated private Heroku query redaction is enabled');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git');
 assert.ok(approval>0&&privacy>approval&&push>privacy,
  'explicit operator approval must precede any private write');
 const approvalStep=yaml.slice(approval,privacy);
 assert.ok(approvalStep.includes('if: ${{ !inputs.validation_only }}'),
  'read-only validation must not require the release phrase');
 assert.ok(approvalStep.includes('JALAN_PRIVATE_RELEASE_CONFIRMATION: ${{ inputs.release_approval }}'),
  'operator-provided phrase must enter via an env var, not raw shell expression');
 assert.ok(approvalStep.includes('RELEASE_JALAN_PRIVATE_HEROKU_CODE'));
 assert.ok(approvalStep.includes('exit 1'));
 assert.ok(!approvalStep.includes('echo "$JALAN_PRIVATE_RELEASE_CONFIRMATION"'),
  'do not print operator input');
});

test('manual pilot release is code-only: no provisioning, credential rotation or config PATCH',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 assert.ok(yaml.includes('run: node server/jalan/check-pilot-manual-release-safety.js'),
  'existing app, current and previous release config must be checked via GET');
 assert.doesNotMatch(yaml,/run:\s*node server\/jalan\/configure-heroku-private-pilot\.js/,
  'never call the side-effecting Heroku config reconciliation helper in a code release');
 assert.doesNotMatch(yaml,/\/config-vars[^\n]*PATCH|method:\s*['"]PATCH['"]/,
  'no Heroku config mutation permitted in manual code-only release');
 const gate=yaml.indexOf('BLOCK private deploy unless prior code release is eligible to restore');
 const baseline=yaml.indexOf('Record pre-push Heroku release baseline (non-secret)');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git');
 assert.ok(gate>0&&baseline>gate&&push>baseline);
 assert.match(yaml,/workflow_dispatch:/);
 assert.doesNotMatch(yaml.split('permissions:')[0],/\n\s*push:/,
  'no automatic code deployment');
});

test('Heroku Git remote name must match approved immutable private app ID (GET only)',async()=>{
 const {verify}=require('./assert-heroku-private-git-target-readonly');
 const {APPS}=require('./audit-heroku-retention-metadata-readonly');
 const app=APPS.find(a=>a.role==='private');
 const live={id:app.id,name:app.name,web_url:'https://jalan-kl-private-pilot.herokuapp.com/'};
 const seen=[];
 const mock=(byId=live,byName=live)=>async(url,options)=>{
  seen.push({url,options});
  return {status:200,json:async()=>url.endsWith('/'+app.id)?byId:byName};
 };
 const key='read-only-fixture-token-123456789';
 const result=await verify({fetcher:mock(),key});
 assert.equal(result.id,app.id);
 assert.deepEqual(seen.map(x=>x.url),[
  'https://api.heroku.com/apps/'+app.id,'https://api.heroku.com/apps/'+app.name]);
 assert.ok(seen.every(x=>x.options.method==='GET'&&x.options.redirect==='error'));
 await assert.rejects(()=>verify({fetcher:mock(live,{...live,id:'another-app-id'}),key}),
  /identity-mismatch/,'name reused by a different app must fail closed');
 await assert.rejects(()=>verify({fetcher:mock({...live,name:'renamed-app'},live),key}),
  /identity-mismatch/,'approved app renamed must fail closed');
 await assert.rejects(()=>verify({fetcher:async()=>({status:401}),key}),
  /identity-unavailable/);
 await assert.rejects(()=>verify({fetcher:mock(),key:''}),/identity-unavailable/);
});

test('manual Heroku Git push rechecks query redaction and exact release snapshot (GET only)',async()=>{
 const {verifyPrePush}=require('./assert-heroku-private-git-target-readonly');
 const {APPS}=require('./audit-heroku-retention-metadata-readonly');
 const app=APPS.find(a=>a.role==='private');
 const baseline={id:'release-15-fixture',version:15,slugId:'slug-15-fixture'};
 const idResponse={id:app.id,name:app.name};
 const feature={name:'http-router-no-log-query',enabled:true};
 const release={id:baseline.id,version:baseline.version,
  slug:{id:baseline.slugId},status:'succeeded'};
 const key='synthetic-local-test-key-0123456789';
 const requestLog=[];
 const mock=(valueFeature=feature,valueRelease=release,options={})=>
  async(url,req)=>{
   requestLog.push({url,req});
   if(options.http401)return {status:401};
   if(url.endsWith('/features/http-router-no-log-query'))
    return {status:200,json:async()=>valueFeature};
   if(url.endsWith('/releases'))
    return {status:200,headers:{get:()=>options.nextRange?'more-pages':null},
     json:async()=>[valueRelease]};
   return {status:200,json:async()=>idResponse};
  };
 assert.deepEqual(await verifyPrePush({fetcher:mock(),key,baseline}),
  {appIdentityPinned:true,routerRedactionEnabled:true,baselineUnchanged:true});
 assert.equal(requestLog.length,4);
 assert.ok(requestLog.every(x=>x.req.method==='GET'&&x.req.redirect==='error'));
 assert.ok(requestLog.some(x=>x.url.endsWith('/'+app.id+'/releases')));
 await assert.rejects(()=>verifyPrePush({fetcher:mock({...feature,enabled:false}),key,baseline}),
  /router-redaction-not-enabled/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(feature,{...release,version:16}),key,baseline}),
  /release-baseline-changed/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(feature,{...release,slug:{id:'different-slug'}}),key,baseline}),
  /release-baseline-changed/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(feature,{...release,status:'pending'}),key,baseline}),
  /release-baseline-changed/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(feature,release,{http401:true}),key,baseline}),
  /identity-unavailable/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(feature,release,{nextRange:true}),key,baseline}),
  /metadata-unavailable/);
 await assert.rejects(()=>verifyPrePush({fetcher:mock(),key,baseline:{...baseline,version:0}}),
  /baseline-invalid/);
});

test('manual code deployment pins name-based Git target before push and validates it again afterwards',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git');
 const guard=yaml.lastIndexOf('node server/jalan/assert-heroku-private-git-target-readonly.js --prepush',push);
 const baseline=yaml.indexOf('Record pre-push Heroku release baseline (non-secret)');
 const after=yaml.indexOf("const {verify}=require('./server/jalan/assert-heroku-private-git-target-readonly')");
 assert.ok(baseline>0&&guard>baseline&&push>guard&&after>push);
 assert.match(yaml,/on:\s*\n\s*workflow_dispatch:/);
 assert.ok(yaml.includes('await verify()'),'post-push canonical URL must recheck app identity');
 assert.doesNotMatch(yaml,/run:\s*node server\/jalan\/configure-heroku-private-pilot\.js/);
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

test('private Heroku deployment validates authenticated mobile UI only after route smoke',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const release=yml.indexOf('Confirm newer successful Heroku release (read-only)');
 const http=yml.indexOf('run: node server/jalan/smoke-heroku-private-pilot.js');
 const install=yml.indexOf('npx playwright install --with-deps chromium');
 const mobile=yml.indexOf('run: node server/jalan/smoke-heroku-private-mobile.js');
 assert.ok(release>0&&http>release&&install>http&&mobile>install);
 assert.ok(yml.includes("if: github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"));
 const source=fs.readFileSync(path.join(__dirname,'smoke-heroku-private-mobile.js'),'utf8');
 assert.ok(source.includes('isMobile:true,hasTouch:true'));
 assert.ok(source.includes('width:390,height:844'));
 assert.ok(source.includes('origin:origin.origin'),'Basic auth must be scoped to canonical pilot origin');
 assert.ok(source.includes('EXPERIMENTAL ONLY'));
 assert.ok(source.includes('Legal driving route verified: NO'));
 assert.ok(!source.includes('console.log(token)')&&!source.includes('console.log(password)'));
});

test('manual validation-only retry pins supported Chromium OS and skips Heroku writes',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const registration=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 assert.match(yaml,/runs-on: ubuntu-24\.04/,
  'Playwright 1.58.2 unsupported on ubuntu-26.04; pin supported OS');
 assert.match(yaml,/validation_only:/);
 assert.match(yaml,/if: \$\{\{ inputs\.validation_only \}\}/,
  'validation-only mode must be explicit and visible in logs');
 for(const name of [
  'Record pre-push Heroku release baseline (non-secret)',
  'Deploy experimental branch to dedicated Heroku Git remote',
  'Verify canonical private pilot URL rejects anonymous visitors',
  'Confirm newer successful Heroku release (read-only)'
 ]){
  const start=yaml.indexOf('      - name: '+name);
  assert.ok(start>0,name+' step must exist');
  const region=yaml.slice(start,start+250);
  assert.ok(region.includes('if: ${{ !inputs.validation_only }}'),
    name+' must not run during validation-only retry');
 }
 assert.ok(yaml.includes('run: node server/jalan/smoke-heroku-private-pilot.js'));
 assert.ok(yaml.includes('run: node server/jalan/smoke-heroku-private-mobile.js'));
 assert.ok(registration.includes('workflow_dispatch:'),'manual dispatch remains available');
});

test('private pilot iPhone safe area keeps route status below top browser chrome',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'kl-pilot-preview.html'),'utf8');
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/padding-top:env\(safe-area-inset-top, 0px\)/);
 assert.match(html,/height:env\(safe-area-inset-top, 0px\)/);
 assert.match(html,/position:fixed;top:0;left:0;right:0/);
 assert.match(html,/pointer-events:none/);
 assert.match(html,/#trip-safety\{line-height:1\.4;overflow-wrap:anywhere\}/);
 const browserJs=fs.readFileSync(path.join(__dirname,'kl-pilot-preview.js'),'utf8');
 assert.match(browserJs,/Legal driving route verified: NO/);
});

test('new manual private Heroku code release verifies road-snap UI, old validation-only path stays compatible',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const mobile=fs.readFileSync(path.join(__dirname,'smoke-heroku-private-mobile.js'),'utf8');
 const browserJs=fs.readFileSync(path.join(__dirname,'kl-pilot-preview.js'),'utf8');
 const step=yaml.indexOf('Verify authenticated 390px private mobile pilot after deployed revision');
 const runner=yaml.indexOf('run: node server/jalan/smoke-heroku-private-mobile.js',step);
 assert.ok(step>0&&runner>step);
 const stepText=yaml.slice(step,runner);
 assert.ok(stepText.includes('JALAN_REQUIRE_SNAP_UI: ${{ !inputs.validation_only }}'),
  'new code deploy must require the snap UI while old validation_only remains permissive');
 assert.ok(mobile.includes("process.env.JALAN_REQUIRE_SNAP_UI==='true'"));
 for(const key of ['Start-to-road snap:','Destination-to-road snap:',
  'Legal driving route verified: NO']){
  assert.ok(browserJs.includes(key),'candidate source missing '+key);
  assert.ok(mobile.includes(key),'postdeploy browser must prove '+key);
 }
 assert.ok(!yaml.includes('  push:\n'),'release workflow must remain strictly manual');
});

test('private Heroku health sampling is bounded, authenticated and never a driving capacity claim',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const src=fs.readFileSync(path.join(__dirname,'smoke-heroku-private-pilot.js'),'utf8');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-routing-tests.yml'),'utf8');
 assert.ok(yaml.includes('run: node server/jalan/smoke-heroku-private-pilot.js'));
 assert.ok(yaml.includes("github.event_name == 'push' && github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"));
 assert.match(src,/for\(let wave=0;wave<2;wave\+\+\)/);
 assert.match(src,/Array\.from\(\{length:4\}/);
 assert.ok(src.includes("request('/api/jalan/kl/health',20000)"));
 assert.ok(src.includes("r.headers.get('cache-control')!=='no-store'"));
 assert.ok(src.includes('Diagnostic sample only; no route throughput or service SLA established'));
 assert.ok(!src.includes('console.log(auth)')&&!src.includes('console.log(token)'));
});

test('manual private code deployment cannot begin before qualified rollback preflight',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const yaml=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows',
  'jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const privacy=yaml.indexOf('BLOCK manual code deployment unless dedicated private Heroku query redaction is enabled');
 const safeguard=yaml.indexOf('BLOCK private deploy unless prior code release is eligible to restore');
 const baseline=yaml.indexOf('Record pre-push Heroku release baseline (non-secret)');
 const push=yaml.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git');
 assert.ok(privacy>0&&safeguard>privacy&&baseline>safeguard&&push>baseline,
  'qualified GET-only rollback preflight must run before the code push');
 assert.ok(!yaml.includes('run: node server/jalan/configure-heroku-private-pilot.js'),
  'code-only release must not write or rotate private Heroku config');
 assert.doesNotMatch(yaml,/\/config-vars[^\n]*PATCH/,
  'deployment workflow must never PATCH config variables');
 assert.ok(yaml.slice(safeguard,baseline).includes('if: ${{ !inputs.validation_only }}'),
  'existing read-only validation-only flow must skip the release gate');
 assert.ok(yaml.includes('run: node server/jalan/check-pilot-manual-release-safety.js'));
 assert.ok(yaml.includes("if: github.ref == 'refs/heads/jalan-v4102-routing-regression-tests'"));
 assert.doesNotMatch(yaml.split('permissions:')[0],/\n\s*push:/,
  'no automatic deployment trigger');
});
