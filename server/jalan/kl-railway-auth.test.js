'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {basic}=require('./run-kl-preview-railway');
test('pilot page rejects requests lacking basic auth',()=>{
 assert.equal(basic({get:()=>undefined}),false);
 assert.equal(basic({get:()=> 'Bearer test'}),false);
 assert.equal(basic({get:()=> 'Basic !!!!'}),false);
});
test('pilot rejects incorrect username even when password is configured',()=>{
 const header='Basic '+Buffer.from('wrong-username:any-password').toString('base64');
 assert.equal(basic({get:()=>header}),false);
});
