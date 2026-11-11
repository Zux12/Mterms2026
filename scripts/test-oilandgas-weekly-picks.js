'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolve}=require('../server/oilandgas/weekly-picks');

const article={reference:'A1',status:'published',publication:{title:'Field lesson',summary:'A practical lesson',byline:'Author One'}};
const paper={reference:'P1',status:'published',publication:{title:'Research paper',summary:'Paper summary',byline:'Author Two'}};
const brief={field:{reference:'A1',teaser:'The weekly field teaser'},research:{reference:'P1',headline:'The weekly research headline',teaser:'The weekly research teaser'}};
const publicEntry=(record,kind)=>({kind,reference:record.reference,...record.publication});
function database(saved={},articles=[article],papers=[paper]){
  return {collection(name){return {async findOne(filter){
    if(name==='homepage'){assert.equal(filter._id,'weekly-picks');return saved;}
    return (name==='articles'?articles:papers).find(r=>r.status===filter.status&&r.publication&&
      (!filter.reference||r.reference===filter.reference)&&
      (!Object.hasOwn(filter,'publicationId')||(r.publicationId??null)===filter.publicationId))||null;
  }};}};
}

test('weekly defaults retain the brief headline and teaser',async()=>{
  const rows=await resolve(database(),publicEntry,async()=>brief);
  assert.equal(rows[0].entry.reference,'A1');
  assert.equal(rows[0].teaser,brief.field.teaser);
  assert.equal(rows[1].headline,brief.research.headline);
  assert.ok(rows.every(row=>row.mode==='weekly'));
});

test('a manual selection remains pinned when the weekly default changes',async()=>{
  const selected={...article,reference:'A2',publicationId:'revision-2',publication:{...article.publication,title:'Chosen article',summary:'Long summary '.repeat(100)}};
  const db=database({field:{kind:'articles',reference:'A2',publicationId:'revision-2'}},[article,selected]);
  const rows=await resolve(db,publicEntry,async()=>({...brief,field:{reference:'A1',teaser:'Next week’s teaser'}}));
  assert.equal(rows[0].mode,'manual');assert.equal(rows[0].headline,'Chosen article');
  assert.equal(rows[0].entry.reference,'A2');assert.ok(rows[0].teaser.length<=301);
  assert.equal(rows[1].headline,brief.research.headline);
});

test('withdrawn or superseded choices fall back to the weekly selection',async()=>{
  for(const selected of [{...article,status:'archived'}, {...article,status:'approved'}, {...article,publicationId:'new-revision'}]){
    const db=database({field:{kind:'articles',reference:'A2',publicationId:'old-revision'}},[article,{...selected,reference:'A2'}]);
    const rows=await resolve(db,publicEntry,async()=>brief);
    assert.equal(rows[0].entry.reference,'A1');assert.equal(rows[0].mode,'weekly');
  }
});

test('either content type is selectable and empty categories do not expose private drafts',async()=>{
  const rows=await resolve(database({field:{kind:'publications',reference:'P1'}}),publicEntry,async()=>brief);
  assert.equal(rows[0].entry.kind,'publications');assert.equal(rows[0].mode,'manual');
  const empty=await resolve(database({},[{...article,status:'pending_review'}],[]),publicEntry,async()=>brief);
  assert.ok(empty.every(row=>row.entry===null));
});
