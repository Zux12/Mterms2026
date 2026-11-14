'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EXPECTED,isIsolatedReadOnlyUri,evaluate,audit}=
 require('./audit-jalan-traffic-retention-readonly');
test('rejects unknown/incorrect Mongo users without network',()=>{
 assert.equal(isIsolatedReadOnlyUri(''),false);
 assert.equal(isIsolatedReadOnlyUri('mongodb+srv://other:dummy@local.invalid/db'),false);
 assert.equal(isIsolatedReadOnlyUri('mongodb+srv://jalan_readonly:dummy@local.invalid/db'),true);
});
test('requires exact at-date TTL 900 seconds; not equivalent to app schema',()=>{
 const ordinary=[{name:'_id_',key:{_id:1}},{name:'cell_1',key:{cell:1}}];
 assert.equal(evaluate(ordinary).ok,false);
 assert.equal(evaluate([...ordinary,{key:{at:1},expireAfterSeconds:900}]).ok,true);
 assert.equal(evaluate([...ordinary,{key:{at:1},expireAfterSeconds:3600}]).ok,false);
 assert.equal(evaluate([...ordinary,{key:{at:1,cell:1},expireAfterSeconds:900}]).ok,false);
 assert.equal(EXPECTED,900);
});
test('reads index metadata only and closes client, without document writes',async()=>{
 const calls=[],logs=[];
 const client={
  async connect(){calls.push('connect');},
  db(name){calls.push('db:'+name);return {collection(coll){
   calls.push('collection:'+coll);
   return {listIndexes(){calls.push('listIndexes');return {
    async toArray(){calls.push('toArray');return [{key:{at:1},expireAfterSeconds:900}];}
   };}};
  }};},
  async close(){calls.push('close');}
 };
 const out=await audit({uri:'mongodb+srv://jalan_readonly:fake@local.invalid/db',
  connect:()=>client,log:s=>logs.push(s)});
 assert.equal(out.ok,true);
 assert.deepEqual(calls,['connect','db:jalan_navigation',
  'collection:traffic_observations','listIndexes','toArray','close']);
 assert.equal(logs.length,2);
});
test('missing TTL fails without accessing document content',async()=>{
 let closed=false;
 const client={
  async connect(){},
  db(){return {collection(){return {listIndexes(){return {async toArray(){return [];}};}};}};},
  async close(){closed=true;}
 };
 await assert.rejects(audit({uri:'mongodb://jalan_readonly:fake@localhost/db',
  connect:()=>client,log:()=>{}}),/retention-index-not-verified/);
 assert.equal(closed,true);
});
