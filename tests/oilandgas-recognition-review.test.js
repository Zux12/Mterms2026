'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {doiFrom,titleMatch,crossrefMetadata,checkEvidence,normalizeScore,review}=
 require('../server/oilandgas/recognition-review');
const paper={reference:'OG-P-1234567890ABCDEF',kind:'publications',
 title:'Novel pipeline integrity evaluation for offshore gas transport',
 summary:'Analysis of corrosion, measurements, risk and maintenance.',topic:'Reliability',
 byline:'A. Researcher, B. Engineer',source:'https://doi.org/10.1000/xyz123'};
const fixture={message:{title:[paper.title],publisher:'Example Publisher',
 author:[{given:'A.',family:'Researcher'}],published:{'date-parts':[[2025,4,1]]},type:'journal-article'}};
test('DOI extracted only from recognized HTTPS DOI host',()=>{
 assert.equal(doiFrom(paper.source),'10.1000/xyz123');
 assert.equal(doiFrom('https://example.com/paper/10.1000/xyz123'),'');
 assert.equal(doiFrom('http://doi.org/10.1000/xyz123'),'');
});
test('bibliographic match is case insensitive but rejects unrelated titles',()=>{
 assert.equal(titleMatch(paper.title,paper.title.toUpperCase()),true);
 assert.equal(titleMatch(paper.title,'Novel optimizations of airplane wing aerodynamics'),false);
});
test('Crossref mismatch blocks rather than inventing a score',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({message:{...fixture.message,title:['Unrelated diagnostic methods for aircraft components']}})});
 const out=await review(paper,{apiKey:'test',fetcher,
 client:{chat:{completions:{create:async()=>{throw Error('AI should never run for mismatched bibliographic record')}}}}});
 assert.equal(out.state,'blocked');
 assert.equal(out.emailEnabled,false);
});
test('AI assessment is bounded, lacks automatic recognition approval and never emails',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>fixture});
 const client={chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify({
  scores:{relevance:20,technical:15,practical:16,evidence:10,originality:5,timeliness:7},
  confidence:'medium',reasoning:'Metadata suggests industrial relevance',limitations:['Full text not reviewed']
 })}}]})}}};
 const out=await review(paper,{apiKey:'unused-test',fetcher,client});
 assert.equal(out.state,'reviewed');
 assert.equal(out.assessment.total,73);
 assert.equal(out.assessment.readyForRecognition,false);
 assert.equal(out.assessment.evidence.integrityCleared,false);
 assert.equal(out.emailEnabled,false);
});
test('no API key does not return a fabricated AI evaluation',async()=>{
 const out=await review(paper,{apiKey:'',fetcher:async()=>({ok:true,json:async()=>fixture})});
 assert.equal(out.state,'configuration_required');
 assert.ok(!out.assessment);
});
test('out-of-range AI score is rejected',()=>{
 assert.throws(()=>normalizeScore({relevance:26,technical:10,practical:10,evidence:10,originality:5,timeliness:5}));
});
