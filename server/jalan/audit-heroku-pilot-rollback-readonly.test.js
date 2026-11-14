'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {choosePreviousCodeRelease,audit}=require('./audit-heroku-pilot-rollback-readonly');
const sha=n=>String(n).repeat(40);
const releases=[
 {version:11,status:'succeeded',slug:{id:'code-new'}},
 {version:10,status:'succeeded',slug:{id:'code-new'}},
 {version:9,status:'failed',slug:{id:'code-bad'}},
 {version:8,status:'succeeded',slug:{id:'code-old'}}
];
test('ignore config-only release and failed code before selecting previous distinct successful slug',()=>{
 const r=choosePreviousCodeRelease(releases);
 assert.equal(r.state,'candidate-found');
 assert.equal(r.currentVersion,11);
 assert.equal(r.previousVersion,8);
});
test('do not claim recovery if previous valid code cannot be found',()=>{
 assert.equal(choosePreviousCodeRelease(releases.slice(0,2)).state,
  'no-previous-distinct-succeeded-code-slug');
});
test('fails closed on current failed release and malformed history',()=>{
 assert.equal(choosePreviousCodeRelease([{version:12,status:'failed',slug:{id:'x'}},...releases]).state,
  'current-release-not-verified');
 assert.throws(()=>choosePreviousCodeRelease({}),/malformed/);
});
test('read-only audit verifies real prior slug metadata, without POST/PATCH/DELETE or secrets in result',async()=>{
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  const suffix=new URL(url).pathname;
  const data=suffix.endsWith('/releases')?releases:
   suffix.endsWith('/slugs/code-new')?{id:'code-new',commit:sha('a')}:
   suffix.endsWith('/slugs/code-old')?{id:'code-old',commit:sha('b')}:
   suffix.endsWith('/jalan-kl-private-pilot')?{name:'jalan-kl-private-pilot'}:null;
  assert.ok(data,'unexpected endpoint');
  return {ok:true,json:async()=>data};
 };
 const result=await audit(fetcher,'a'.repeat(20));
 assert.equal(result.state,'previous-code-slug-metadata-verified');
 assert.equal(result.restoreTested,false);
 assert.equal(result.candidateDifferentGitCommit,true);
 assert.deepEqual(requests.map(r=>new URL(r.url).pathname),[
  '/apps/jalan-kl-private-pilot','/apps/jalan-kl-private-pilot/releases',
  '/apps/jalan-kl-private-pilot/slugs/code-new',
  '/apps/jalan-kl-private-pilot/slugs/code-old']);
 assert.ok(requests.every(r=>!r.options.method||r.options.method==='GET'));
 assert.ok(!JSON.stringify(result).includes('Bearer'));
});
test('same underlying slug commits do not count as verified distinct recovery code',async()=>{
 const fn=async url=>{
  const path=new URL(url).pathname;
  const data=path.endsWith('/releases')?releases:
   path.endsWith('/jalan-kl-private-pilot')?{name:'jalan-kl-private-pilot'}:
   path.endsWith('/slugs/code-new')?{id:'code-new',commit:sha('a')}:
   {id:'code-old',commit:sha('a')};
  return {ok:true,json:async()=>data};
 };
 const result=await audit(fn,'b'.repeat(20));
 assert.equal(result.state,'distinct-recovery-code-unverified');
});
