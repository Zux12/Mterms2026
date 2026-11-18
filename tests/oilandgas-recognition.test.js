'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {weekStart,scorePaper}=require('../server/oilandgas/recognition');
test('weekly cycle begins Monday at 09:00 MYT',()=>{
 assert.equal(weekStart(new Date('2026-11-16T00:00:00.000Z')).toISOString(),'2026-11-09T01:00:00.000Z');
 assert.equal(weekStart(new Date('2026-11-16T01:00:00.000Z')).toISOString(),'2026-11-16T01:00:00.000Z');
 assert.equal(weekStart(new Date('2026-11-22T14:00:00.000Z')).toISOString(),'2026-11-16T01:00:00.000Z');
});
test('scores never exceed transparent 100 point rubric',()=>{
 const s=scorePaper({title:'Novel oil and gas pipeline safety implementation',
 summary:'Case study experiment method performance optimization innovation reliability sustainability results',
 topic:'Reliability',source:'https://doi.org/10.1234/example'});
 assert.ok(s.total>=0&&s.total<=100);
 assert.equal(s.total,100);
 assert.equal(s.mode,'rule-based-provisional');
});
test('missing evidence is not treated as fully verified',()=>{
 const s=scorePaper({title:'General note',summary:'',topic:'',source:''});
 assert.ok(s.total<65);
});
test('only admin SMTP is wired; recognition publication never enables author emails',()=>{
 const file=require('node:fs').readFileSync(require.resolve('../server/oilandgas/recognition'),'utf8');
 assert.match(file,/admin-email\/test/); // see below: explicit admin-only evidence
 assert.match(file,/authorEmailsEnabled:false/);
 assert.match(file,/OIL_RECOGNITION_ACTIVATION_ENABLED/);
});

test('provisional keyword scores are reproducible and explain each criterion',()=>{
 const paper={title:'Novel oil and gas measurement method',summary:'The paper describes emissions analysis for a refinery with validated case study results.',topic:'Measurement',source:'https://doi.org/10.1000/example'};
 const first=scorePaper(paper),second=scorePaper(paper);
 assert.deepEqual(first,second);
 assert.equal(first.explanations.length,6);
 assert.equal(first.rubricVersion,'provisional-keyword-v1');
 for(const e of first.explanations){
  assert.equal(e.points,first.breakdown[e.criterion]);
  assert.equal(typeof e.limitation,'string');
  if(e.criterion!=='evidence'&&e.points>0) assert.ok(e.signal);
 }
});
test('provisional evidence URL does not claim independently proven research quality',()=>{
 const s=scorePaper({title:'General research paper',summary:'',topic:'',source:'https://doi.org/10.1000/test'});
 assert.equal(s.breakdown.evidence,15);
 assert.match(s.explanations.find(x=>x.criterion==='evidence').limitation,/not independent verification/i);
 assert.match(s.note,/Do not use as evidence of technical merit/i);
});
