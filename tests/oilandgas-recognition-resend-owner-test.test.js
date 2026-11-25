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
 assert.match(body.html,/https:\/\/oilandgas\.eu\.com\/letter-demo\.html/);
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

test('four rehearsal slots use one private inbox and never send after the requested time', async () => {
 const { scheduleSlot, slots } = require('../server/oilandgas/recognition-owner-rehearsal');
 assert.deepEqual(slots, [
  '2026-11-25T15:00:00.000Z', '2026-11-26T00:00:00.000Z',
  '2026-11-26T04:00:00.000Z', '2026-11-27T00:00:00.000Z'
 ]);
 for (const [index, scheduledAt] of slots.entries()) {
  const id = 'WRRP-owner-20261125-' + (index + 1);
  let saved;
  const jobs = {
   async findOneAndUpdate(query) {
    assert.equal(query._id, id);
    assert.equal(query.scheduledAt, scheduledAt);
    return { subject:'Preview', text:'Letter', html:'<p>Letter</p>', pdf:'JVBERi0=',
     to:['author@example.org'], cc:['copy@example.org'], bcc:['hidden@example.org'] };
   },
   async updateOne(query, update) { assert.equal(query._id, id); saved = update.$set; }
  };
  const fetcher = async (url, init) => {
   assert.equal(url, 'https://api.resend.com/emails');
   assert.equal(init.headers['Idempotency-Key'], id);
   const body = JSON.parse(init.body);
   assert.deepEqual(body.to, [TO]);
   assert.equal(body.from, FROM);
   assert.equal(body.scheduled_at, scheduledAt);
   assert.ok(!body.cc && !body.bcc && !body.reply_to);
   assert.equal(body.attachments.length, 1);
   return { ok:true, json:async () => ({ id:'mock-provider-id' }) };
  };
  await scheduleSlot(jobs, index, new Date('2026-11-25T12:00:00Z'), 'mock', fetcher);
  assert.equal(saved.state, 'scheduled');
  assert.equal(saved.providerMessageId, 'mock-provider-id');
  await scheduleSlot(null, index, new Date(scheduledAt), 'mock', null);
 }
});

test('an editorial replacement confirms cancellation before scheduling clean copy to the owner', async () => {
 const { scheduleSlot, slots } = require('../server/oilandgas/recognition-owner-rehearsal');
 const job = { state: 'cancel-pending', providerMessageId: 'old', originalProviderMessageId: 'old',
   subject: 'Industry Impact Spotlight', text: 'Congratulations.', html: '<p>Congratulations.</p>', pdf: 'JVBERi0=' };
 const jobs = { async findOneAndUpdate() { return { ...job }; },
   async updateOne(filter, update) { Object.assign(job, update.$set); } };
 const now = new Date('2026-11-25T20:00:00Z');
 await scheduleSlot(jobs, 1, now, 'mock', async (url) => {
   assert.equal(url, 'https://api.resend.com/emails/old/cancel');
   return { ok: false, status: 429, json: async () => ({name: 'rate_limit'}) };
 });
 assert.equal(job.state, 'cancel-pending');
 await scheduleSlot(jobs, 1, now, 'mock', async (url) => {
   assert.equal(url, 'https://api.resend.com/emails/old/cancel');
   return { ok: true, json: async () => ({ id: 'old' }) };
 });
 assert.equal(job.state, 'replacement-ready');
 await scheduleSlot(jobs, 1, now, 'mock', async (url, opts) => {
   assert.equal(url, 'https://api.resend.com/emails');
   assert.equal(opts.headers['Idempotency-Key'], 'WRRP-owner-20261125-2-editorial-v2');
   const body = JSON.parse(opts.body);
   assert.deepEqual(body.to, [TO]);
   assert.ok(!body.cc && !body.bcc);
   assert.equal(body.subject, job.subject);
   assert.equal(body.scheduled_at, slots[1]);
   assert.equal(body.attachments[0].filename, 'Letter of Recognition.pdf');
   return { ok: true, json: async () => ({ id: 'new' }) };
 });
 assert.equal(job.state, 'scheduled');
 assert.equal(job.providerMessageId, 'new');
 assert.equal(job.originalProviderMessageId, 'old');
});
