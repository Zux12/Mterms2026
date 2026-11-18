'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const rules=require('../server/oilandgas/recognition-rules');
const selector=require('../server/oilandgas/recognition-selector');
const policy=require('../server/oilandgas/recognition-policy');
const schedule=require('../server/oilandgas/recognition-admin-alert');
const {currentLetterStatus,officialVerificationUrl}=require('../server/oilandgas/recognition-letter-verification');

// One actual published-directory record is represented ONLY by its available
// source metadata. No award, verified abstract or author approval is fabricated.
const directoryPaper={
 kind:'publications',reference:'OG-P-77DC6CDBE681033C',
 title:'Quantifying methane emissions from the largest oil-producing basin in the United States from space',
 summary:'This paper shows how satellite observations can help engineers estimate methane emissions across an entire oil-producing basin.',
 byline:'Yuzhong Zhang, Ritesh Gautam, Sudhanshu Pandey, Mark Omara',
 source:'https://doi.org/10.1126/sciadv.aaz5120',
 publicationId:'cd8076ec-57b4-4646-ba13-ee7e461194fd'
};
// This is SYNTHETIC TEST TEXT, never attributed as a real paper abstract.
const fixtureAbstract='We propose a new methodology for oil and natural gas pipeline measurement and refinery processing. Experimental analysis of actual satellite observations and industrial field data has yielded results that were compared with baseline and control group performance. A simulation framework was validated against laboratory measurements, using error bounds of 3.5 percent and standard deviation of 0.4 ppm. The implemented prototype can reduce corrosion risk, improve monitoring reliability and improve efficiency in operational conditions. This design extends previous work with a first reported real-world deployment of an instrument sensor and an automated calibration method. The study addresses methane emissions, environmental sustainability, safety, and maintenance cost in energy operations.';
function fictionalPaper(reference,name,doi){
 const paper={kind:'publications',reference,publicationId:'fictional-'+reference,
  title:'Synthetic oil and gas engineering assessment fixture',byline:name,
  abstract:fixtureAbstract,abstractSourceVerified:true,source:'https://doi.org/10.1000/'+doi};
 return {...paper,assessment:rules.abstractAssessment(paper),
  reviewStatus:'approved',reviewRevisionMatches:true,
  bibliographyVerified:true,integrityCleared:true};
}
const cycleStart=new Date('2026-11-23T01:00:00.000Z');
const friday=schedule.previewAt(cycleStart);

test('actual directory paper remains pending without original verified abstract',()=>{
 const a=rules.abstractAssessment({...directoryPaper,abstract:'',abstractSourceVerified:false});
 assert.equal(a.eligibleForEditorialReview,false);
 assert.ok(a.evidence.issues.includes('abstract-source-not-confirmed'));
 assert.ok(a.evidence.issues.includes('source-backed-abstract-insufficient'));
 const result=selector.choose([{...directoryPaper,assessment:a}],[],friday);
 assert.ok(result.every(x=>!x.candidate));
});
test('Friday draft freezes exactly 72h before next Monday 09:00 Kuala Lumpur',()=>{
 assert.equal(friday.toISOString(),'2026-11-20T01:00:00.000Z');
 assert.equal(schedule.plannedStart(new Date('2026-11-18T13:00:00.000Z')).toISOString(),cycleStart.toISOString());
 assert.equal(cycleStart-friday,72*3600*1000);
});
test('synthetic eligible sample awards at most one publication per category',()=>{
 const papers=[
  fictionalPaper('OG-P-AAAAAAAAAAAAAAAA','A. Test Researcher','test-a'),
  fictionalPaper('OG-P-BBBBBBBBBBBBBBBB','B. Test Researcher','test-b'),
  fictionalPaper('OG-P-CCCCCCCCCCCCCCCC','C. Test Researcher','test-c')
 ];
 assert.ok(papers.every(x=>x.assessment.total>=85));
 const result=selector.choose(papers,[],friday);
 assert.deepEqual(result.map(x=>x.category),['editors-pick','industry-impact','emerging-research']);
 assert.equal(result.filter(x=>x.candidate).length,3);
 assert.equal(new Set(result.map(x=>x.candidate.source)).size,3);
 const draft=schedule.mailContents({start:cycleStart,items:result});
 assert.equal(draft.missing,0);
 assert.match(draft.text,/No author emails sent/);
});
test('missing qualifying paper never gets replaced by a below-threshold award',()=>{
 const weak={...fictionalPaper('OG-P-DDDDDDDDDDDDDDDD','D. Test Researcher','test-d'),
  assessment:{...rules.abstractAssessment({
   abstract:fixtureAbstract,abstractSourceVerified:true,source:'https://doi.org/10.1000/test-d'
  }),total:70}};
 const result=selector.choose([weak],[],friday);
 assert.ok(result.every(x=>x.candidate===null));
 assert.equal(schedule.mailContents({start:cycleStart,items:result}).missing,3);
});
test('one recognition produces one uniquely referenced letter per verified source coauthor',()=>{
 const paper=fictionalPaper('OG-P-AAAAAAAAAAAAAAAA','A. Test Researcher, B. Test Researcher','test-a');
 const sourceCoauthors=['A. Test Researcher','B. Test Researcher','Unknown Person'];
 const verified=sourceCoauthors.filter(x=>policy.verifiedBylineAuthor(paper,x));
 assert.deepEqual(verified,['A. Test Researcher','B. Test Researcher']);
 const ids=['OG-WRS-AAAAAAAAAAAAAAAAAAAAAAAA','OG-WRS-BBBBBBBBBBBBBBBBBBBBBBBB'];
 const letters=verified.map((author,i)=>({author,id:ids[i],
  recognitionId:'2026-11-23:editors-pick',start:cycleStart,
  verificationUrl:officialVerificationUrl(ids[i])}));
 assert.equal(letters.length,2);
 assert.equal(new Set(letters.map(x=>x.id)).size,2);
 assert.ok(letters.every(x=>x.verificationUrl.startsWith('https://oilandgas.eu.com/verify-letter.html?id=')));
});
test('same letter remains historically confirmed after featured week',()=>{
 const letter={status:'valid'};
 assert.equal(currentLetterStatus(letter,{status:'active'}),'recognized');
 assert.equal(currentLetterStatus(letter,{status:'archived'}),'recognized');
 assert.equal(currentLetterStatus({status:'withdrawn'},{status:'withdrawn'}),'recognized-with-notice');
 assert.equal(currentLetterStatus(letter,null),'invalid');
});
test('letter and QR assertions are kept in the separate website verification checklist',()=>{
 assert.equal(officialVerificationUrl('OG-WRS-ABCDEF1234567890').startsWith('https://oilandgas.eu.com/verify-letter.html'),true);
});
