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
test('recognition never enables email transport',()=>{
 const file=require('node:fs').readFileSync(require.resolve('../server/oilandgas/recognition'),'utf8');
 assert.doesNotMatch(file,/sendMail\s*\(/);
 assert.doesNotMatch(file,/createTransport\s*\(/);
});
