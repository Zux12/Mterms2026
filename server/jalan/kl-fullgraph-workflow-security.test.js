'use strict';
// Static CI guard for the experimental KL full-graph smoke job.
// Does not read credentials, connect to Atlas, or exercise production routing.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/jalan-routing-tests.yml'),'utf8');
const marker='\n  kl-fullgraph:\n';
const job=workflow.split(marker)[1];
const preSteps=job?.split('\n    steps:\n')[0];
const credential='JALAN_READONLY_MONGODB_URI: ${{ secrets.JALAN_READONLY_MONGODB_URI }}';

test('authenticated full-graph smoke cannot run on pull requests or arbitrary refs',()=>{
 assert.ok(job,'KL full-graph job must exist');
 assert.ok(preSteps,'KL full-graph job must define steps');
 assert.match(preSteps,/if:.*github\.event_name == 'push'.*github\.event_name == 'workflow_dispatch'.*github\.ref == 'refs\/heads\/jalan-v4102-routing-regression-tests'/);
 assert.doesNotMatch(preSteps,/if:.*pull_request/);
 assert.match(preSteps,/permissions:\n      contents: read/);
});

test('MongoDB read-only secret is absent from job-wide and dependency-install environments',()=>{
 assert.ok(job);
 assert.doesNotMatch(preSteps,/JALAN_READONLY_MONGODB_URI|secrets\./);
 assert.equal(job.split(credential).length-1,2,'exactly two scoped secret references');
 const installAt=job.indexOf('npm install --ignore-scripts --no-audit --no-fund');
 const verifyAt=job.indexOf('- name: Verify dedicated read-only connection is configured');
 assert.ok(installAt>=0&&installAt<verifyAt,'dependencies install before scoped credential steps');
});

test('only explicit credential-check and route-collection steps bind the MongoDB secret',()=>{
 assert.match(job,/- name: Verify dedicated read-only connection is configured\n        env:\n          JALAN_READONLY_MONGODB_URI: \$\{\{ secrets\.JALAN_READONLY_MONGODB_URI \}\}\n        shell: bash/);
 assert.match(job,/- name: Run full-graph smoke case \(partial 20-case acceptance is expected\)\n        env:\n          JALAN_READONLY_MONGODB_URI: \$\{\{ secrets\.JALAN_READONLY_MONGODB_URI \}\}\n        shell: bash/);
 assert.doesNotMatch(workflow.split('\n  kl-fullgraph:\n')[0],/secrets\.JALAN_READONLY_MONGODB_URI/);
});


// The separate manual smoke workflow must obey the same credential boundary
// as the regular routing CI. In particular, workflow_dispatch can otherwise
// be targeted at an arbitrary branch while carrying the repository secret.
const manualWorkflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/jalan-kl-fullgraph-manual.yml'),'utf8');
const manualJob=manualWorkflow.split('\n  kl-fullgraph:\n')[1];
const manualPreSteps=manualJob?.split('\n    steps:\n')[0];

test('manual KL full-graph smoke is gated to the dedicated trusted ref',()=>{
 assert.ok(manualJob,'manual full-graph job must exist');
 assert.ok(manualPreSteps,'manual job must define steps');
 assert.match(manualWorkflow,/^on:\n  workflow_dispatch:\n  push:\n    branches: \[jalan-v4102-routing-regression-tests\]/m);
 assert.match(manualPreSteps,/if:.*github\.event_name == 'push'.*github\.event_name == 'workflow_dispatch'.*github\.ref == 'refs\/heads\/jalan-v4102-routing-regression-tests'/);
 assert.doesNotMatch(manualWorkflow,/^\s+pull_request:/m);
 assert.match(manualWorkflow,/^permissions:\n  contents: read/m);
});

test('manual KL full-graph workflow never exposes MongoDB credentials at job scope',()=>{
 assert.ok(manualPreSteps);
 assert.doesNotMatch(manualPreSteps,/JALAN_READONLY_MONGODB_URI|secrets\./);
 assert.equal(manualJob.split(credential).length-1,2,'exactly two step-scoped secret references');
 const installAt=manualJob.indexOf('npm install --ignore-scripts --no-audit --no-fund');
 const verifyAt=manualJob.indexOf('- name: Verify dedicated read-only connection is configured');
 assert.ok(installAt>=0&&installAt<verifyAt,'dependency installation precedes credential steps');
});

test('manual smoke scopes read-only credential only to verification and collection',()=>{
 assert.match(manualJob,/- name: Verify dedicated read-only connection is configured\n        env:\n          JALAN_READONLY_MONGODB_URI: \$\{\{ secrets\.JALAN_READONLY_MONGODB_URI \}\}\n        shell: bash/);
 assert.match(manualJob,/- name: Run full-graph smoke case \(partial 20-case acceptance is expected\)\n        env:\n          JALAN_READONLY_MONGODB_URI: \$\{\{ secrets\.JALAN_READONLY_MONGODB_URI \}\}\n        shell: bash/);
 assert.doesNotMatch(manualWorkflow.split('\n  kl-fullgraph:\n')[0],/secrets\.JALAN_READONLY_MONGODB_URI/);
});
