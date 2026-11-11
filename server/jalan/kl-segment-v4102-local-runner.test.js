'use strict';
// Static safety checks for the local-only full-graph runner.
// No network, database connection, or private coordinates are used in CI.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const file=path.join(__dirname,'run-kl-local-readonly.js');
test('local full-graph runner has valid Node syntax',()=>{
 const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
});
test('local full-graph runner binds loopback and requires read-only credential',()=>{
 const source=fs.readFileSync(file,'utf8');
 assert.match(source,/127\.0\.0\.1/);
 assert.match(source,/JALAN_READONLY_MONGODB_URI/);
 assert.match(source,/flag:'wx',mode:0o600/);
 assert.doesNotMatch(source,/0\.0\.0\.0/);
});

test('local runner uses per-execution random session authorization',()=>{
 const source=fs.readFileSync(file,'utf8');
 assert.match(source,/randomBytes\(32\)/);
 assert.match(source,/timingSafeEqual/);
 assert.match(source,/x-jalan-local-session/);
 assert.match(source,/authHeader:'x-jalan-local-session',authValue:sessionToken/);
 assert.doesNotMatch(source,/console\.log\(sessionToken\)/);
});
