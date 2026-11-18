'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {abstractAssessment,VERSION,weights}=require('../server/oilandgas/recognition-rules');
const abstract='We use new satellite observations and an atmospheric inversion model to quantify methane emissions from a natural gas and oil production basin. Based on actual satellite observations collected across multiple operating regions, measured methane emissions were 2.7 ± 0.5 Tg per year, which is more than two times higher than bottom-up inventory based estimates. This comparison of measured data and baseline results demonstrates potential applications of the method in operational monitoring and environmental risk assessment. The new approach may help operators identify areas requiring closer inspection and reduce uncertainty in regional emission inventories. The study is limited by satellite coverage and seasonal sampling, and further validation in different basins would be valuable.';
const paper={abstract,abstractSourceVerified:true,source:'https://doi.org/10.1126/sciadv.aaz5120',integrityStatus:''};
test('deterministic 100-point weighted assessment explains every category',()=>{
 const x=abstractAssessment(paper),y=abstractAssessment(paper);
 assert.deepEqual(x,y);assert.equal(x.version,VERSION);
 assert.equal(Object.values(weights).reduce((a,b)=>a+b,0),100);
 assert.equal(Object.values(x.breakdown).reduce((a,b)=>a+b,0),x.total);
 assert.equal(Object.keys(x.reasons).length,6);
 assert.ok(x.total>=0&&x.total<=100);
 assert.equal(x.eligibleForEditorialReview,true);
 assert.equal(x.readyForRecognition,false);
});
test('short summary cannot qualify even if high scoring keywords are present',()=>{
 const p=abstractAssessment({...paper,abstract:'Novel refinery model with methane and pipeline simulation.'});
 assert.equal(p.eligibleForEditorialReview,false);
 assert.ok(p.evidence.issues.includes('source-backed-abstract-insufficient'));
});
test('unverified abstract and integrity holds do not pass',()=>{
 assert.equal(abstractAssessment({...paper,abstractSourceVerified:false}).eligibleForEditorialReview,false);
 assert.equal(abstractAssessment({...paper,integrityStatus:'retracted'}).eligibleForEditorialReview,false);
});
test('same keyword repeated cannot earn extra points',()=>{
 const first=abstractAssessment(paper);
 const repeated=abstractAssessment({...paper,abstract:abstract+' methane methane methane methane'});
 assert.equal(first.breakdown.relevance,repeated.breakdown.relevance);
});
test('no AI dependency or author email in deterministic engine',()=>{
 const file=require('node:fs').readFileSync(require.resolve('../server/oilandgas/recognition-rules'),'utf8');
 assert.doesNotMatch(file,/require\(['"]openai['"]\)/);
 assert.doesNotMatch(file,/sendMail\s*\(/);
});
