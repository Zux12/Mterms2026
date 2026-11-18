'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crossrefAbstract,cleanMarkup}=require('../server/oilandgas/recognition-source');
const title='Quantifying methane emissions from the largest oil-producing basin in the United States from space';
const text='We use new satellite observations and an atmospheric inversion model to quantify methane emissions from a natural gas and oil production basin. Based on actual satellite observations collected across multiple operating regions, measured methane emissions were 2.7 ± 0.5 Tg per year, which is more than two times higher than bottom-up inventory based estimates. This comparison of measured data and baseline results demonstrates potential applications of the method in operational monitoring and environmental risk assessment. The new approach may help operators identify areas requiring closer inspection and reduce uncertainty in regional emission inventories. The study is limited by satellite coverage and seasonal sampling, and further validation in different basins would be valuable.';
const paper={title,source:'https://doi.org/10.1126/sciadv.aaz5120'};
test('Crossref matching title and full abstract can be imported',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>({message:{title:[title],abstract:'<jats:p>'+text+'</jats:p>'}})});
 const result=await crossrefAbstract(paper,{fetcher});
 assert.equal(result.status,'verified');assert.match(result.abstract,/satellite observations/);
});
test('Crossref metadata missing full abstract stays pending',async()=>{
 const result=await crossrefAbstract(paper,{fetcher:async()=>({ok:true,json:async()=>({message:{title:[title]}})})});
 assert.equal(result.status,'abstract-insufficient');
});
test('Mismatched title must not import content',async()=>{
 const result=await crossrefAbstract(paper,{fetcher:async()=>({ok:true,json:async()=>({message:{title:['Unrelated methods in medical practice'],abstract:text}})})});
 assert.equal(result.status,'title-mismatch');
});
test('Non-DOI source requires manual verification',async()=>{
 const result=await crossrefAbstract({...paper,source:'https://example.org/paper/12'},{
  fetcher:async()=>{throw Error('Should never fetch arbitrary URL')}});
 assert.equal(result.status,'doi-required');
});
test('Markup extraction removes tags and script content',()=>{
 const v=cleanMarkup('<jats:p>Valid &amp; verified</jats:p><script>evil()</script>');
 assert.equal(v,'Valid & verified');
});
