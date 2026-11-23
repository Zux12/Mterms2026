'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DB,COLLECTIONS,evaluate,audit}=require('./audit-jalan-current-community-retention-readonly');
const URI='mongodb+srv://jalan_readonly:fake@local.invalid/jalan_navigation';
const good=[{name:'_id_',key:{_id:1}},{name:'expiresAt_1',key:{expiresAt:1},expireAfterSeconds:0}];
test('checks the current flow and report-bucket collections, never historical traffic_observations',()=>{
 assert.equal(DB,'jalan_navigation');
 assert.deepEqual(COLLECTIONS,['community_flow_segments','community_report_buckets']);
 assert.equal(evaluate(good).ttlZeroExpiryIndex,true);
 assert.equal(evaluate(good).ttlIndexCount,1);
});
test('fails closed for absent, wrong TTL, compound-key and duplicate TTL indexes',()=>{
 for(const indexes of [
  [],[{key:{expiresAt:1},expireAfterSeconds:300}],
  [{key:{at:1},expireAfterSeconds:900}],
  [{key:{expiresAt:1,region:1},expireAfterSeconds:0}],
  [...good,{key:{expiresAt:1},expireAfterSeconds:0}]
 ])assert.equal(evaluate(indexes).ttlZeroExpiryIndex,false);
 assert.throws(()=>evaluate(null),/invalid-index-metadata/);
});
test('uses only listIndexes for both collections, never retrieves data or writes',async()=>{
 const calls=[],logs=[];
 const client={
  async connect(){calls.push('connect');},
  db(name){calls.push('db:'+name);return {collection(name){
   calls.push('collection:'+name);
   return {listIndexes(){calls.push('listIndexes:'+name);return {
    async toArray(){calls.push('toArray:'+name);return good;}
   };}};
  }};},
  async close(){calls.push('close');}
 };
 const result=await audit({uri:URI,connect:()=>client,log:s=>logs.push(s)});
 assert.equal(result.ok,true);
 assert.deepEqual(calls,['connect','db:jalan_navigation',
  'collection:community_flow_segments','listIndexes:community_flow_segments','toArray:community_flow_segments',
  'collection:community_report_buckets','listIndexes:community_report_buckets','toArray:community_report_buckets','close']);
 assert.equal(logs.length,2);
 assert.ok(!logs.join('').includes('fake@'));
});
test('failure closes DB and does not mistake historical index for current one',async()=>{
 let closed=false;
 const client={
  async connect(){},
  db(){return {collection(name){return {listIndexes(){return {async toArray(){
   return name==='community_flow_segments'?[{key:{at:1},expireAfterSeconds:900}]:good;
  }};}};}};},
  async close(){closed=true;}
 };
 await assert.rejects(audit({uri:URI,connect:()=>client,log:()=>{}}),
  /current-community-retention-index-not-verified/);
 assert.equal(closed,true);
});
test('rejects unapproved credential before Mongo connection',async()=>{
 let connected=false;
 await assert.rejects(audit({uri:'mongodb://other:fake@localhost/db',
  connect:()=>{connected=true;throw Error('must not call');},log:()=>{}}),
 /isolated-readonly-credential-required/);
 assert.equal(connected,false);
});
