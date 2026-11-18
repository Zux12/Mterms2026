'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../server/oilandgas/recognition-rules');
const selector=require('../server/oilandgas/recognition-selector');
const policy=require('../server/oilandgas/recognition-policy');
const schedule=require('../server/oilandgas/recognition-admin-alert');
const {currentLetterStatus,officialVerificationUrl}=require('../server/oilandgas/recognition-letter-verification');

const realDirectoryRecord={
 kind:'publications',reference:'OG-P-77DC6CDBE681033C',
 title:'Quantifying methane emissions from the largest oil-producing basin in the United States from space',
 summary:'This paper shows how satellite observations can help engineers estimate methane emissions across an entire oil-producing basin.',
 topic:'Measurement',
 byline:'Yuzhong Zhang, Ritesh Gautam, Sudhanshu Pandey, Mark Omara',
 source:'https://doi.org/10.1126/sciadv.aaz5120'
};
const fixtureSummary='A field case study on offshore refinery pipelines presents a new monitoring and measurement system. The developed framework combines experimental methods, analysis, models, simulations, comparisons and results to evaluate improved efficiency. Practical deployment and implementation reduce safety risk, methane emissions, carbon impact, maintenance cost, reliability issues and processing performance. It includes instrument testing, data analysis and an innovative first approach.';
function synthetic(ref,name,id){
 const paper={kind:'publications',reference:ref,publicationId:id,
  title:'Novel new upstream oil and natural gas pipeline refinery monitoring method and energy risk framework',
  summary:fixtureSummary,topic:'Instrumentation & Control',
  byline:name,source:'https://doi.org/10.1000/'+id};
 return {...paper,assessment:rules.directoryAssessment(paper),
  reviewStatus:'approved',reviewRevisionMatches:true,bibliographyVerified:true,integrityCleared:true};
}
const cycleStart=new Date('2026-11-23T01:00:00.000Z'),friday=schedule.previewAt(cycleStart);
test('real published-paper directory entry can be scored without abstract but cannot pass source check by score alone',()=>{
 const paper={...realDirectoryRecord,assessment:rules.directoryAssessment(realDirectoryRecord)};
 assert.equal(paper.assessment.eligibleForEditorialReview,true);
 assert.equal(paper.assessment.mode,'rule-based-directory');
 assert.equal(paper.assessment.readyForRecognition,false);
 assert.ok(selector.choose([paper],[],friday).every(x=>!x.candidate));
});
test('same score does not depend on longer full abstracts',()=>{
 const a=rules.directoryAssessment({...realDirectoryRecord,abstract:'different complete original abstract'});
 const b=rules.directoryAssessment({...realDirectoryRecord,abstract:'',abstractSourceVerified:false});
 assert.deepEqual(a,b);
});
test('Friday preview is exactly 72 hours before Monday 09:00 MYT',()=>{
 assert.equal(friday.toISOString(),'2026-11-20T01:00:00.000Z');
 assert.equal(cycleStart-friday,72*3600*1000);
});
test('cleared fictional directory records can fill three categories with distinct sources',()=>{
 const papers=[synthetic('OG-P-AAAAAAAAAAAAAAAA','A Researcher','a'),
  synthetic('OG-P-BBBBBBBBBBBBBBBB','B Researcher','b'),
  synthetic('OG-P-CCCCCCCCCCCCCCCC','C Researcher','c')];
 assert.ok(papers.every(x=>x.assessment.total>=85));
 const rows=selector.choose(papers,[],friday);
 assert.equal(rows.filter(x=>x.candidate).length,3);
 assert.equal(new Set(rows.map(x=>x.candidate.source)).size,3);
 assert.equal(schedule.mailContents({start:cycleStart,items:rows}).missing,0);
});
test('no publication scores high enough means no fake winners',()=>{
 const weak=synthetic('OG-P-DDDDDDDDDDDDDDDD','D Researcher','d');
 weak.assessment={...weak.assessment,total:70};
 const rows=selector.choose([weak],[],friday);
 assert.ok(rows.every(x=>x.candidate===null));
});
test('verified byline author gets a separate QR reference',()=>{
 const p=synthetic('OG-P-AAAAAAAAAAAAAAAA','A Researcher, B Researcher','a');
 assert.equal(policy.verifiedBylineAuthor(p,'A Researcher'),true);
 assert.equal(policy.verifiedBylineAuthor(p,'Someone Else'),false);
 assert.match(officialVerificationUrl('OG-WRS-ABCDEF1234567890'),/^https:\/\/oilandgas\.eu\.com\/verify-letter\.html\?id=/);
});
test('recognition stays in historical record after featured week ends',()=>{
 assert.equal(currentLetterStatus({status:'valid'},{status:'active'}),'recognized');
 assert.equal(currentLetterStatus({status:'valid'},{status:'archived'}),'recognized');
 assert.equal(currentLetterStatus({status:'withdrawn'},{status:'withdrawn'}),'recognized-with-notice');
});
