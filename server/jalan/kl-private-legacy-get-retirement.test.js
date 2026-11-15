'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {rejectPrivateLegacyGet}=require('./run-kl-preview-railway');
test('dedicated pilot legacy GET route is retired before graph and rate limit',()=>{
 let nexts=0,status=null,result=null;
 const res={status(v){status=v;return this},json(v){result=v;return this}};
 rejectPrivateLegacyGet({method:'GET',path:'/route',query:{startLat:'3.13'}},res,()=>nexts++);
 assert.equal(status,410);assert.equal(result.ok,false);
 assert.match(result.error,/retired/);assert.equal(nexts,0);
 assert.ok(!JSON.stringify(result).includes('3.13'));
});
test('dedicated pilot permits JSON POST and non-route health through middleware',()=>{
 let calls=0;const res={status(){throw Error('unexpected rejection')}};
 for(const req of [{method:'POST',path:'/route'},{method:'GET',path:'/health'}])
  rejectPrivateLegacyGet(req,res,()=>calls++);
 assert.equal(calls,2);
});
test('manual workflow enforces new-route POST smoke only for code promotion',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const workflow=fs.readFileSync(path.join(__dirname,'..','..','.github','workflows','jalan-heroku-private-pilot-deploy.yml'),'utf8');
 const preflight=workflow.indexOf('--require-enabled');
 const push=workflow.indexOf('git push --force https://git.heroku.com/jalan-kl-private-pilot.git');
 const verify=workflow.indexOf('JALAN_REQUIRE_POST_ROUTE: ${{ !inputs.validation_only }}');
 assert.ok(preflight>0&&preflight<push&&verify>push);
 const smoke=fs.readFileSync(path.join(__dirname,'smoke-heroku-private-pilot.js'),'utf8');
 assert.ok(smoke.includes("legacy.status!==410"));
 assert.ok(smoke.includes("method:'POST'"));
});
