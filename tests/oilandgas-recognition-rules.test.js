'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {directoryAssessment,VERSION,weights}=require('../server/oilandgas/recognition-rules');
const p={title:'Novel safety monitoring method for oil and gas pipelines',
 summary:'A field case study presents a measurement system for process risk and reliability improvement.',
 topic:'Measurement',byline:'A. Test Researcher',source:'https://doi.org/10.1000/sample'};
test('directory keyword score is repeatable and totals exactly six weighted categories',()=>{
 const a=directoryAssessment(p),b=directoryAssessment(p);
 assert.deepEqual(a,b);assert.equal(a.version,VERSION);
 assert.equal(Object.values(weights).reduce((x,y)=>x+y,0),100);
 assert.equal(Object.values(a.breakdown).reduce((x,y)=>x+y,0),a.total);
 assert.equal(Object.keys(a.reasons).length,6);assert.equal(a.mode,'rule-based-directory');
 assert.equal(a.eligibleForEditorialReview,true);
});
test('short published summary is assessed using exactly the same rules',()=>{
 const tiny=directoryAssessment({...p,summary:'Field measurement and reliability analysis.'});
 assert.equal(tiny.eligibleForEditorialReview,true);
 assert.deepEqual(tiny.evidence.inputFields,['title','summary','topic','source','byline']);
 assert.ok(tiny.total>=0&&tiny.total<=100);
});
test('external abstract is neither required nor allowed to change the competition score',()=>{
 const a=directoryAssessment({...p,abstract:'Novel innovation massive gains',abstractSourceVerified:true});
 const b=directoryAssessment({...p,abstract:'unrelated external text',abstractSourceVerified:false});
 assert.deepEqual(a,b);
});
test('repeating a word does not inflate the score',()=>{
 const original=directoryAssessment(p);
 const repeated=directoryAssessment({...p,summary:p.summary+' oil oil oil oil oil'});
 assert.equal(original.breakdown.relevance,repeated.breakdown.relevance);
});
test('scores alone cannot clear a retraction hold or missing identity',()=>{
 const retracted=directoryAssessment({...p,integrityStatus:'retracted'});
 assert.equal(retracted.eligibleForEditorialReview,false);
 const missing=directoryAssessment({...p,byline:''});
 assert.equal(missing.eligibleForEditorialReview,false);
});
test('evidence points mean metadata traceability, not experiment validation',()=>{
 const a=directoryAssessment(p);
 assert.ok(a.reasons.evidence.includes('source link provided'));
 assert.match(a.note,/not scientific validation/i);
});
test('engine contains no LLM, AI API or author mail sender',()=>{
 const file=require('node:fs').readFileSync(require.resolve('../server/oilandgas/recognition-rules'),'utf8');
 assert.doesNotMatch(file,/require\(['"]openai['"]\)/);
 assert.doesNotMatch(file,/sendMail\s*\(/);
});

test('generic oil and gas sector wording does not count as both upstream and midstream',()=>{
 const a=directoryAssessment({title:'Enterprise risk management in the oil and gas sector',
  summary:'This review examines enterprise governance for management performance.',
  topic:'Other',byline:'A Researcher',source:'https://doi.org/10.1000/erm'});
 assert.equal(a.matches.relevance.some(x=>x.signal==='upstream'),false);
 assert.equal(a.matches.relevance.some(x=>x.signal==='midstream'),false);
 assert.equal(a.matches.relevance.some(x=>x.signal==='sector and priorities'),true);
});
test('plural sensors and measurements count as measurement terminology',()=>{
 const a=directoryAssessment({title:'Sensors for ultrasonic measurements',
  summary:'Research sensors support calibration and instrument monitoring.',
  topic:'Sensors',byline:'A Researcher',source:'https://doi.org/10.1000/sensors'});
 assert.equal(a.matches.relevance.some(x=>x.signal==='measurement'),true);
 assert.equal(a.matches.technical.some(x=>x.signal==='measurement and experimentation'),true);
});
test('ordinary use of first is not an originality claim',()=>{
 const a=directoryAssessment({title:'Risk assessment of operational hazards',
  summary:'The team decides which risk to address first.',
  topic:'Safety',byline:'A Researcher',source:'https://doi.org/10.1000/risk'});
 assert.equal(a.matches.originality.some(x=>x.signal==='explicit novelty'),false);
});
test('generic analytic hierarchy process is not evidence of refinery processing',()=>{
 const a=directoryAssessment({title:'Analytic hierarchy process for manufacturing risk',
  summary:'An industrial safety study based on prioritization.',
  topic:'Safety',byline:'A Researcher',source:'https://doi.org/10.1000/ahp'});
 assert.equal(a.matches.relevance.some(x=>x.signal==='downstream'),false);
});
