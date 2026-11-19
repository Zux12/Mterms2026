'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const backend=fs.readFileSync(path.join(__dirname,'../server/oilandgas/recognition.js'),'utf8');
const editor=fs.readFileSync(path.join(__dirname,'../server/oilandgas/editor.js'),'utf8');
const dashboard=fs.readFileSync(path.join(__dirname,'../server/oilandgas/desk/recognition.html'),'utf8');
const controller=fs.readFileSync(path.join(__dirname,'../server/oilandgas/desk/recognition.js'),'utf8');
test('full archive and scored recognition record routes cannot be requested from public router',()=>{
 assert.doesNotMatch(backend,/publicRouter\.get\('\/archive'/);
 assert.doesNotMatch(backend,/publicRouter\.get\('\/record\/:id'/);
 assert.match(backend,/adminRouter\.get\('\/archive'/);
 assert.match(backend,/adminRouter\.get\('\/record\/:id'/);
});
test('admin-only route inherits real Editor Desk session protection',()=>{
 const session=editor.indexOf("require('./recognition').adminRouter");
 const gate=editor.lastIndexOf("Please sign in.",session);
 assert.ok(session>0&&gate>0&&gate<session);
 assert.match(editor,/router\.use\('\/recognition', require\('\.\/recognition'\)\.adminRouter\)/);
});
test('admin archive does not use publicly cacheable responses',()=>{
 assert.match(backend,/'Cache-Control':'no-store, private'/);
 assert.match(backend,/'X-Robots-Tag':'noindex, nofollow'/);
});
test('unique-reference letter and QR status stay public and separate from private archive',()=>{
 assert.match(backend,/publicRouter\.get\('\/verify\/:id'/);
 assert.match(backend,/publicRouter\.get\('\/letter-link\/:token'/);
 assert.match(backend,/publicRouter\.get\('\/current'/);
});
test('admin user can search the private archive with standard authenticated API and view historic scorecard',()=>{
 assert.match(dashboard,/id="private-recognition-archive"/);
 assert.match(dashboard,/id="private-archive-filter"/);
 assert.match(controller,/api\('archive\?'\+params\)/);
 assert.match(controller,/View private scorecard/);
});
