'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readiness,sendOwnerTest,FROM,TO}=require('../server/oilandgas/recognition-resend-owner-test');
test('Recognition From identity and test mailbox are fixed',()=>{
 assert.equal(FROM,'Oil & Gas Editorial Team <recognition@oilandgas.eu.com>');
 assert.equal(TO,'m.zurix@oilandgas.eu.com');
 assert.equal(readiness({}).configured,false);
 assert.equal(readiness({OIL_RECOGNITION_RESEND_API_KEY:'re_fake_for_test'}).configured,true);
 assert.equal(readiness({}).authorEmailsEnabled,false);
});
test('Mock Resend request sends ONLY to owner with stable idempotency key',async()=>{
 let request;
 const fetcher=async(url,init)=>{request={url,...init};return {ok:true,json:async()=>({id:'test-provider-123'})}};
 const result=await sendOwnerTest({key:'re_fake_for_test',
  idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',fetcher});
 assert.equal(request.url,'https://api.resend.com/emails');
 assert.equal(request.headers['Idempotency-Key'],'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000');
 const body=JSON.parse(request.body);
 assert.deepEqual(body.to,['m.zurix@oilandgas.eu.com']);
 assert.equal(body.from,FROM);assert.equal(body.reply_to,TO);
 assert.match(body.subject,/OWNER TEST/);
 assert.equal(result.state,'accepted-by-resend');
});
test('Invalid API credentials never trigger any request',async()=>{
 let called=false;
 await assert.rejects(()=>sendOwnerTest({key:'',idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',
  fetcher:async()=>{called=true;}}));
 assert.equal(called,false);
});
test('Provider rejection does not claim delivery',async()=>{
 await assert.rejects(()=>sendOwnerTest({key:'re_fake_for_test',
  idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',
  fetcher:async()=>({ok:false,status:403,json:async()=>({name:'validation_error'})})}),
  /declined/);
});
