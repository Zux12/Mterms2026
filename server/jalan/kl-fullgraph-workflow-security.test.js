'use strict';
// Static checks only: no secrets fetched, no Atlas access, no production routing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../../.github/workflows');
const regular = fs.readFileSync(path.join(dir, 'jalan-routing-tests.yml'), 'utf8');
const manual = fs.readFileSync(path.join(dir, 'jalan-kl-fullgraph-manual.yml'), 'utf8');
const credential = 'JALAN_READONLY_MONGODB_URI: $' + '{{ secrets.JALAN_READONLY_MONGODB_URI }}';

function verifyScope(content, expectedSteps) {
 const job = content.split('\n  kl-fullgraph:\n')[1];
 assert.ok(job, 'full-graph job must exist');
 const header = job.split('\n    steps:\n')[0];
 assert.ok(header, 'full-graph job header must exist');
 assert.match(header, /if:.*github\.event_name == 'push'.*github\.event_name == 'workflow_dispatch'.*github\.ref == 'refs\/heads\/jalan-v4102-routing-regression-tests'/);
 assert.doesNotMatch(header, /(?:env:|JALAN_READONLY_MONGODB_URI|secrets\.)/);
 assert.doesNotMatch(content.split('\n  kl-fullgraph:\n')[0], /secrets\.JALAN_READONLY_MONGODB_URI/);
 assert.equal(job.split(credential).length - 1, expectedSteps.length, 'unexpected number of secret exposures');
 const namedAndUnnamedSteps = job.split('\n      - ').slice(1);
 const actual = namedAndUnnamedSteps.filter(step => step.includes(credential)).map(step => {
   const name = step.match(/^name: ([^\n]+)/);
   return name ? name[1] : '(unnamed step)';
 });
 assert.deepEqual(actual, expectedSteps, 'secret only allowed in named steps that need Atlas');
 const installAt = job.indexOf('npm install --ignore-scripts --no-audit --no-fund');
 const verifyAt = job.indexOf('- name: Verify dedicated read-only connection is configured');
 assert.ok(installAt >= 0 && installAt < verifyAt, 'dependencies must install without Atlas secret');
}

test('regular full-graph workflow is ref-gated and secrets are step scoped', () => {
 verifyScope(regular, [
   'Verify dedicated read-only connection is configured',
   'Run full-graph smoke case (partial 20-case acceptance is expected)',
   'Audit complete imported KL turn-restriction readiness (read-only)',
   'Smoke-test isolated KL preview over real loopback HTTP (read-only)'
 ]);
});
test('manual full-graph workflow is ref-gated and secrets are step scoped', () => {
 assert.doesNotMatch(manual, /^\s+pull_request:/m);
 assert.match(manual, /^permissions:\n  contents: read/m);
 verifyScope(manual, [
   'Verify dedicated read-only connection is configured',
   'Run full-graph smoke case (partial 20-case acceptance is expected)'
 ]);
});
test('HTTP smoke step uses genuine YAML line breaks and retains cleanup', () => {
 assert.doesNotMatch(regular, /\\n[ \t]+(?:run:|- name:)/);
 assert.match(regular, /- name: Smoke-test isolated KL preview over real loopback HTTP \(read-only\)\n        env:\n          JALAN_READONLY_MONGODB_URI:/);
 assert.match(regular, /run: node server\/jalan\/smoke-kl-preview-local\.js\n      - name: Remove private local inputs and sanitized evidence/);
 assert.match(regular, /- name: Remove private local inputs and sanitized evidence\n        if: always\(\)/);
});
test('routing tests execute this workflow guard', () => {
 assert.match(regular, /^      - run: node --test .+server\/jalan\/kl-fullgraph-workflow-security\.test\.js$/m);
 assert.match(regular, /    permissions:\n      contents: read\n    steps:/);
});
