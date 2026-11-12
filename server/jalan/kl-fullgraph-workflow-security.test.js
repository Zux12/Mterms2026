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
