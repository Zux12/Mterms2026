'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {credibleRetraction,inspect}=require('../server/oilandgas/recognition-integrity');
test('explicit Crossref retraction update triggers concern',()=>{
 assert.equal(credibleRetraction({update:[{type:'retraction',label:'Retraction'}]})?.type,'retraction');
 assert.equal(credibleRetraction({relation:{'is-retracted-by':[{id:'10.1000/notice'}]}})?.type,'retraction');
});
test('ordinary related metadata never implies retraction',()=>{
 assert.equal(credibleRetraction({update:[{type:'correction',label:'Correction'}]}),null);
 assert.equal(credibleRetraction({relation:{'references':[{id:'10.1000/reference'}]}}),null);
});
test('DOI retraction source is read-only and evidence bounded',async()=>{
 const p={source:'https://doi.org/10.1000/example'};
 const data=await inspect(p,{fetcher:async()=>({ok:true,json:async()=>({message:{
  update:[{type:'retraction',label:'Retraction'}]
 }})})});
 assert.equal(data.state,'explicit-retraction');
 assert.match(data.evidenceUrl,/api.crossref.org/);
});
test('no Crossref notice is not equivalent to integrity clearance',async()=>{
 const data=await inspect({source:'https://doi.org/10.1000/example'},{
  fetcher:async()=>({ok:true,json:async()=>({message:{}})})});
 assert.equal(data.state,'no-explicit-notice-found');
 assert.match(data.disclaimer,/not scientific integrity clearance/i);
});
