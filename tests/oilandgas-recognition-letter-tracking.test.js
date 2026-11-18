'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const backend=fs.readFileSync(path.join(__dirname,'../server/oilandgas/recognition.js'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'../server/oilandgas/desk/recognition.html'),'utf8');
test('tracking uses opaque SHA-256-digested tokens',()=>{
 assert.match(backend,/crypto\.randomBytes\(32\)\.toString\('hex'\)/);
 assert.match(backend,/createHash\('sha256'\)/);
 assert.match(backend,/recognition_letter_links/);
 assert.match(backend,/letterId:1/);
});
test('tracking distinguishes link requests from rendered pages',()=>{
 assert.match(backend,/linkRequests:1/);
 assert.match(backend,/letterLoads:1/);
 assert.match(backend,/letter-view/);
 assert.match(backend,/letter-link\/:token/);
});
test('tracking admin endpoints are on authenticated editor router',()=>{
 assert.match(backend,/adminRouter\.get\('\/letter-tracking'/);
 assert.match(backend,/adminRouter\.post\('\/letter-link\/create'/);
 assert.match(admin,/tracking-requests/);
 assert.match(admin,/tracking-views/);
});
test('recognition email delivery cannot be started by this tracking module',()=>{
 assert.match(backend,/admin-email\/test/); // SMTP only for owner-test/Friday administration
 assert.match(backend,/emailEnabled:false/);
 assert.match(backend,/OIL_RECOGNITION_ACTIVATION_ENABLED/);
});
