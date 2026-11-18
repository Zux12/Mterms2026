'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {reviewPairs,overlap,authorOverlap}=require('../server/oilandgas/recognition-related-review');
const p=(reference,title,byline,score)=>({reference,title,byline,assessment:{total:score}});
test('same research team and near-identical conference-paper title is flagged cautiously',()=>{
 const pair=reviewPairs([
  p('OG-P-AAAAAAAAAAAAAAAA','Processing Capability Improvement Through Parameter Optimization of a Sludge Drying Plant',
   'M. Z. Mohamed, M. F. M. Ghazali, S. M. Idrus, N. A. Wahab',75),
  p('OG-P-BBBBBBBBBBBBBBBB','Parameter Optimization of a Sludge Drying Plant for Processing Capability Improvement',
   'M. Z. Mohamed, M. F. M. Ghazali, S. M. Idrus, N. A. Wahab',75)
 ]);
 assert.equal(pair.length,1);
 assert.equal(pair[0].flag,'manual-related-publication-review');
 assert.match(pair[0].explanation,/not infer plagiarism/i);
});
test('repeated authors alone do not equate different research studies',()=>{
 const pairs=reviewPairs([
  p('A','Novel method for parameter identification of sludge drying plant',
   'M. Z. Mohamed, M. F. M. Ghazali',70),
  p('B','Neural network controller for vibration monitoring in refinery',
   'M. Z. Mohamed, M. F. M. Ghazali',66)
 ]);
 assert.equal(pairs.length,0);
});
test('below-threshold papers are not in high-ranked publication-pair monitor',()=>{
 const pairs=reviewPairs([
  p('A','Optimization of sludge drying plant capacity','A Researcher, B Researcher',59),
  p('B','Optimization of sludge drying plant capability','A Researcher, B Researcher',70)
 ],{minimumScore:60});
 assert.equal(pairs.length,0);
});
test('similar title with unrelated authors does not trigger an unsupported allegation',()=>{
 assert.equal(reviewPairs([
  p('A','Optimization of sludge drying plant capacity','A Researcher',75),
  p('B','Optimization of sludge drying plant capacity','B Researcher',75)
 ]).length,0);
});
