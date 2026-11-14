'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
test('operator loopback evidence runner uses the private no-store and no-fingerprint contract',()=>{
 const source=fs.readFileSync(path.join(__dirname,'run-kl-local-readonly.js'),'utf8');
 const app=source.indexOf('const app=express()');
 const hide=source.indexOf("app.disable('x-powered-by')",app);
 const noStore=source.indexOf("res.set('Cache-Control','no-store')",hide);
 const auth=source.indexOf("app.use('/api/jalan/kl'",noStore);
 const collector=source.indexOf('await collectEvidence(',auth);
 assert.ok(app>=0&&hide>app&&noStore>hide&&auth>noStore&&collector>auth,
  'sensitive evidence API must apply HTTP safety headers before private token auth and route collection');
 assert.ok(source.includes("const {collectEvidence,validateCases}=require('./collect-kl-route-evidence')"),
  'continue using strict evidence collector without downgrading its header validation');
});
