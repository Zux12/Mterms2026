'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {choose,authorCooldown,paperCooldown,eligibleReview}=require('../server/oilandgas/recognition-selector');
const base={kind:'publications',assessment:{mode:'ai-full-paper-evidence-assessment',fullPaperEvidenceReviewed:true,total:92,
 breakdown:{relevance:24,technical:18,practical:19,evidence:14,originality:8,timeliness:9},
 evidence:{bibliographyVerified:true,integrityCleared:true},readyForRecognition:true},
 reviewStatus:'approved',reviewRevisionMatches:true};
const p=(reference,byline,opts={})=>({...base,reference,byline,...opts});
test('shortlist requires verified approved integrity reviews',()=>{
 const drafts=[p('a','A. Researcher',{reviewStatus:'pending-editorial-and-integrity-review'}),
 p('b','B. Researcher',{assessment:{...base.assessment,evidence:{bibliographyVerified:true,integrityCleared:false}}}),
 p('c','C. Researcher',{reviewRevisionMatches:false})];
 assert.equal(choose(drafts,[],new Date('2026-11-16')).every(x=>!x.candidate),true);
 assert.equal(eligibleReview(drafts[0]),false);
});
test('three distinct papers for three categories with unique authors',()=>{
 const records=[p('a','A. Researcher'),p('b','B. Researcher'),p('c','C. Researcher')];
 const results=choose(records,[],new Date('2026-11-16'));
 assert.equal(results.filter(x=>x.candidate).length,3);
 assert.equal(new Set(results.map(x=>x.candidate.reference)).size,3);
});
test('Lifetime paper repeat excluded and 12-week author repeat avoided',()=>{
 const now=new Date('2026-11-16T01:00:00Z');
 const history=[{kind:'publications',reference:'old',byline:'A. Researcher',start:new Date('2026-10-10')}];
 assert.equal(paperCooldown(p('old','A. Researcher'),history,now.getTime()),true);
 assert.equal(authorCooldown(p('new','A. Researcher'),history,now.getTime()),true);
 const sel=choose([p('old','A. Researcher'),p('new','A. Researcher'),p('fresh','B. Researcher')],history,now);
 assert.equal(sel[0].candidate.reference,'fresh');
});
test('Malaysian preference is narrow, not a large quality override',()=>{
 const good=p('global','G. Researcher',{assessment:{...base.assessment,total:96}});
 const mal=p('malaysia','M. Researcher',{malaysianAffiliationVerified:true,assessment:{...base.assessment,total:92}});
 const r=choose([good,mal],[],new Date('2026-11-16'));
 assert.equal(r[0].candidate.reference,'malaysia');
 const r2=choose([p('higher','G. Researcher',{assessment:{...base.assessment,total:100}}),mal],[],new Date('2026-11-16'));
 assert.equal(r2[0].candidate.reference,'higher');
});
test('score below threshold cannot receive an automatic recognition',()=>{
 const low=p('low','A. Researcher',{assessment:{...base.assessment,total:70}});
 const r=choose([low],[],new Date('2026-11-16'));
 assert.ok(r.every(x=>x.candidate===null));
});

test('a paper remains permanently excluded after multiple years and across categories',()=>{
 const now=new Date('2035-11-16T01:00:00Z');
 const old={kind:'publications',reference:'OG-P-OLD',publicationId:'paper-123',byline:'A. Researcher',
   category:'editors-pick',start:new Date('2026-11-16'),status:'archived'};
 assert.equal(paperCooldown(p('OG-P-OLD','A. Researcher'),[old],now.getTime()),true);
 assert.equal(paperCooldown(p('OG-P-RENAMED','A. Researcher',{publicationId:'paper-123'}),[old],now.getTime()),true);
 const results=choose([p('OG-P-OLD','A. Researcher'),p('new','B. Researcher')],[old],now);
 assert.equal(results[0].candidate.reference,'new');
 assert.equal(results.some(x=>x.candidate?.reference==='OG-P-OLD'),false);
});
test('all exhausted categories remain empty instead of recycling old papers',()=>{
 const old={kind:'publications',reference:'exhausted',byline:'A. Researcher',start:new Date('2020-01-01'),status:'archived'};
 const results=choose([p('exhausted','A. Researcher')],[old],new Date('2036-01-01'));
 assert.ok(results.every(x=>x.candidate===null));
});
