'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {previewAt,plannedStart,mailContents,escapeHtml}=require('../server/oilandgas/recognition-admin-alert');
test('Friday 9 AM MYT is exactly 72 hours before Monday 9 AM MYT',()=>{
 const now=new Date('2026-11-18T04:00:00Z'); // Wednesday 12:00 MYT
 const monday=plannedStart(now);
 assert.equal(monday.toISOString(),'2026-11-22T01:00:00.000Z'.replace('22','23'));
 assert.equal(previewAt(monday).toISOString(),'2026-11-20T01:00:00.000Z');
 assert.equal(monday-previewAt(monday),72*3600000);
});
test('Monday immediately after publication targets next Monday',()=>{
 assert.equal(plannedStart(new Date('2026-11-23T01:01:00Z')).toISOString(),'2026-11-30T01:00:00.000Z');
});
test('Email shows three categories and an explicit vacancy warning',()=>{
 const monday=new Date('2026-11-23T01:00:00Z');
 const m=mailContents({start:monday,items:[{
  category:'editors-pick',candidate:{title:'Example refinery study',byline:'Dr Example',
  reference:'OG-P-1234567890ABCDEF',assessment:{total:91}}}]});
 assert.equal(m.missing,2);
 assert.match(m.subject,/2 unfilled/);
 assert.match(m.html,/No qualified paper/);
 assert.match(m.html,/Editor&#39;s Pick/);
 assert.match(m.html,/9:00 AM MYT/);
 assert.match(m.text,/No author emails sent/);
});
test('Candidate metadata is HTML escaped, not executable in email',()=>{
 const m=mailContents({start:new Date('2026-11-23T01:00:00Z'),items:[{
  category:'editors-pick',candidate:{title:'<script>alert("bad")</script>',
   byline:'Researcher & colleagues',reference:'x',assessment:{total:90}}}]});
 assert.doesNotMatch(m.html,/<script>/);
 assert.match(m.html,/&lt;script&gt;/);
 assert.match(m.html,/Researcher &amp; colleagues/);
 assert.equal(escapeHtml('<>&'), '&lt;&gt;&amp;');
});
