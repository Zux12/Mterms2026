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
 assert.equal(body.from,FROM);
 assert.equal(Object.hasOwn(body,'reply_to'),false);
 assert.equal(JSON.stringify(body).includes('m.zurix@oilandgas.eu.com'),true);
 assert.equal(body.html.includes('m.zurix@oilandgas.eu.com'),false);
 assert.equal(body.text.includes('m.zurix@oilandgas.eu.com'),false);
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

test('mock congratulations design test is only addressed to owner with no Reply-To or fabricated award',async()=>{
 let body=null;
 const result=await sendOwnerTest({key:'re_fake_for_test',variant:'congratulations-demo',
  idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',
  fetcher:async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>({id:'demo-owner-test-id'})}}});
 assert.deepEqual(body.to,['m.zurix@oilandgas.eu.com']);
 assert.equal(body.from,FROM);
 assert.equal(Object.hasOwn(body,'reply_to'),false);
 assert.match(body.subject,/DESIGN TEST — NO AWARDS/);
 assert.match(body.html,/Congratulations!/);
 assert.match(body.html,/DEMONSTRATION EMAIL — NO RECOGNITION ISSUED/);
 assert.match(body.html,/Illustrative Research Paper/);
 assert.match(body.html,/https:\/\/oilandgas\.eu\.com\/recognition\.html/);
 assert.doesNotMatch(body.html,/letter\.html\?id=|OG-WRS-[A-Z0-9-]+/);
 assert.doesNotMatch(body.html,/m\.zurix@/);
 assert.equal(result.state,'accepted-by-resend');
});
test('unexpected sender variant is rejected before contacting provider',async()=>{
 let called=false;
 await assert.rejects(()=>sendOwnerTest({key:'re_fake_for_test',variant:'author-notification',
  idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',
  fetcher:async()=>{called=true;return {ok:true,json:async()=>({id:'wrong'})}}}));
 assert.equal(called,false);
});

test('staging A4 letter and QR sample is only sent to owner without fake recognition',async()=>{
 let body;
 const result=await sendOwnerTest({key:'re_fake_for_test',variant:'letter-demo',
  idempotencyKey:'wrrp-owner-test-123e4567-e89b-12d3-a456-426614174000',
  fetcher:async(_url,opts)=>{body=JSON.parse(opts.body);return {ok:true,json:async()=>({id:'letter-demo-test-id'})}}});
 assert.equal(result.state,'accepted-by-resend');
 assert.deepEqual(body.to,['m.zurix@oilandgas.eu.com']);
 assert.equal(body.from,FROM);
 assert.equal(Object.hasOwn(body,'reply_to'),false);
 assert.match(body.subject,/STAGING TEST — NO AWARDS/);
 assert.match(body.html,/letter-demo\.html/);
 assert.match(body.html,/NO AWARD ISSUED/);
 assert.doesNotMatch(body.html,/letter\.html\?id=|OG-WRS-[A-Z0-9-]+/);
 assert.doesNotMatch(body.html,/m\.zurix@/);
});
