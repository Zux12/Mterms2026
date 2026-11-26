'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {DB,COLLECTIONS,mongoEndpoint,verifyOriginalBinding,evaluate,audit}=
 require('./audit-jalan-current-community-retention-readonly');
const URI='mongodb+srv://jalan_readonly:fake@local.invalid/jalan_navigation';
const HEROKU_KEY='test-heroku-credential-string';
const APP_ID='123e4567-e89b-12d3-a456-426614174000';
const good=[{name:'_id_',key:{_id:1}},{name:'expiresAt_1',key:{expiresAt:1},expireAfterSeconds:0}];
function appFetch({name='mterm2026',id=APP_ID,
 database='mongodb+srv://owner:secret@local.invalid/other',
 status=200}={}){
 const calls=[];
 const fetcher=async (url,options)=>{
  calls.push({url,method:options.method,redirect:options.redirect});
  assert.equal(options.method,'GET');
  assert.equal(options.redirect,'error');
  assert.ok(!url.includes('fake@')&&!url.includes('secret@'));
  return {ok:status===200,status,async json(){
   return url.endsWith('/config-vars')?{MTERM2026_DB_URI:database}:{name,id};
  }};
 };
 return {fetcher,calls};
}
function mockMongo(indexes=good){
 const calls=[];
 const client={
  async connect(){calls.push('connect');},
  db(name){calls.push('db:'+name);return {collection(name){
   calls.push('collection:'+name);
   return {listIndexes(){calls.push('listIndexes:'+name);return {
    async toArray(){calls.push('toArray:'+name);return indexes;}
   };}};
  }};},
  async close(){calls.push('close');}
 };
 return {client,calls};
}
const params=(fetcher,client,log=()=>{})=>
 ({uri:URI,expectedAppId:APP_ID,key:HEROKU_KEY,fetcher,connect:()=>client,log});

test('checks current flow and report collections, never historical traffic_observations',()=>{
 assert.equal(DB,'jalan_navigation');
 assert.deepEqual(COLLECTIONS,['community_flow_segments','community_report_buckets']);
 assert.equal(evaluate(good).ttlZeroExpiryIndex,true);
 assert.equal(evaluate(good).ttlIndexCount,1);
});
test('rejects absent, partial, sparse, wrong, compound and duplicate TTL metadata',()=>{
 for(const indexes of [
  [],[{key:{expiresAt:1},expireAfterSeconds:300}],
  [{key:{at:1},expireAfterSeconds:900}],
  [{key:{expiresAt:1,region:1},expireAfterSeconds:0}],
  [...good,{key:{expiresAt:1},expireAfterSeconds:0}],
  [{key:{expiresAt:1},expireAfterSeconds:0,partialFilterExpression:{type:'traffic'}}],
  [{key:{expiresAt:1},expireAfterSeconds:0,partialFilterExpression:{}}],
  [{key:{expiresAt:1},expireAfterSeconds:0,sparse:true}]
 ])assert.equal(evaluate(indexes).ttlZeroExpiryIndex,false);
 assert.throws(()=>evaluate(null),/invalid-index-metadata/);
});
test('binds approved immutable original app UUID to same Mongo endpoint, with no secret output',async()=>{
 const {fetcher,calls}=appFetch();
 const result=await verifyOriginalBinding({uri:URI,expectedAppId:APP_ID,key:HEROKU_KEY,fetcher});
 assert.equal(result,true);
 assert.deepEqual(calls.map(x=>x.url),[
  'https://api.heroku.com/apps/'+APP_ID,
  'https://api.heroku.com/apps/'+APP_ID+'/config-vars']);
 assert.equal(mongoEndpoint(URI),'mongodb+srv://local.invalid');
 assert.equal(mongoEndpoint('mongodb+srv://owner:secret@local.invalid/other'),'mongodb+srv://local.invalid');
 for(const value of ['junk','https://local.invalid/','mongodb+srv://nouser.local.invalid/'])
  assert.throws(()=>mongoEndpoint(value),/invalid-mongodb-endpoint/);
});
test('rejects wrong app ID, aliases, Mongo endpoint, malformed credentials and Heroku HTTP before Mongo access',async()=>{
 const scenarios=[
  {expectedAppId:'mterm2026',fetcher:appFetch().fetcher},
  {expectedAppId:'00000000-0000-0000-0000-000000000001',fetcher:appFetch().fetcher},
  {expectedAppId:APP_ID,fetcher:appFetch({id:'00000000-0000-0000-0000-000000000001'}).fetcher},
  {expectedAppId:APP_ID,fetcher:appFetch({name:'jalan-kl-private-pilot'}).fetcher},
  {expectedAppId:APP_ID,fetcher:appFetch({database:'mongodb+srv://x:secret@unrelated.invalid/other'}).fetcher},
  {expectedAppId:APP_ID,fetcher:appFetch({status:401}).fetcher}
 ];
 for(const s of scenarios){
  const mongo=mockMongo();
  const opts={...params(s.fetcher,mongo.client),expectedAppId:s.expectedAppId};
  await assert.rejects(audit(opts),/approved|original-app|heroku|datastore/);
  assert.deepEqual(mongo.calls,[]);
 }
});
test('uses only listIndexes after immutable app binding; no user documents or writes',async()=>{
 const m=mockMongo(),{fetcher,calls}=appFetch(),logs=[];
 const result=await audit(params(fetcher,m.client,s=>logs.push(s)));
 assert.equal(result.ok,true);
 assert.deepEqual(m.calls,['connect','db:jalan_navigation',
  'collection:community_flow_segments','listIndexes:community_flow_segments','toArray:community_flow_segments',
  'collection:community_report_buckets','listIndexes:community_report_buckets','toArray:community_report_buckets','close']);
 assert.equal(calls.length,2);
 assert.equal(logs.length,2);
 assert.ok(!logs.join('').includes('fake@'));
 assert.ok(!logs.join('').includes('local.invalid'));
});
test('index failure closes DB and does not confuse retired TTL for current retention',async()=>{
 const m=mockMongo([{key:{at:1},expireAfterSeconds:900}]);
 await assert.rejects(audit(params(appFetch().fetcher,m.client)),
  /current-community-retention-index-not-verified/);
 assert.equal(m.calls.at(-1),'close');
});
test('rejects wrong read-only username before Heroku or Mongo network',async()=>{
 let contacted=false;
 await assert.rejects(audit({uri:'mongodb://other:fake@localhost/db',
  expectedAppId:APP_ID,key:HEROKU_KEY,
  fetcher:()=>{contacted=true;throw Error('must not call');},
  connect:()=>{contacted=true;throw Error('must not call');},log:()=>{}}),
  /isolated-readonly-credential-required/);
 assert.equal(contacted,false);
});


test('manual TTL-only dispatch excludes unrelated graph and browser jobs',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/jalan-routing-tests.yml'),'utf8');
 function body(name){
  const marker='\n  '+name+':\n',start=workflow.indexOf(marker);
  assert.ok(start>=0,'missing job: '+name);
  const remaining=workflow.slice(start+marker.length);
  const next=remaining.search(/\n  [a-z][a-z0-9-]*:\n/);
  return next<0?remaining:remaining.slice(0,next);
 }
 for(const name of ['test','kl-fullgraph','browser-preview','browser-realgraph']){
  assert.match(body(name),/inputs\.original_community_retention != true/,
   name+' must be skipped on explicit original-app TTL audit');
 }
 const auditJob=body('original-community-retention-readonly');
 assert.match(auditJob,/inputs\.original_community_retention == true/);
 assert.match(auditJob,/github\.ref == 'refs\/heads\/jalan-v4102-routing-regression-tests'/);
 assert.match(auditJob,/run: node server\/jalan\/audit-jalan-current-community-retention-readonly\.js/);
});

test('manual original-app retention secrets are scoped only to audit execution',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const workflow=fs.readFileSync(path.join(__dirname,'../../.github/workflows/jalan-routing-tests.yml'),'utf8');
 const job=workflow.split('\n  original-community-retention-readonly:\n')[1].split('\n  browser-preview:\n')[0];
 const step='      - name: Pin original Heroku app + live Mongo endpoint before index-only reads\n';
 const parts=job.split(step);
 assert.equal(parts.length,2);
 assert.doesNotMatch(parts[0],/\$\{\{\s*secrets\.|^\s*env:/m,'no secret exposure during setup or install');
 assert.match(parts[0],/persist-credentials: false/);
 assert.match(parts[0],/npm install --ignore-scripts --no-audit --no-fund/);
 assert.match(parts[1],/^        env:\n/);
 for(const name of ['HEROKU_API_KEY','JALAN_EXPECTED_ORIGINAL_APP_ID','JALAN_READONLY_MONGODB_URI']){
  assert.ok(parts[1].includes(name+': $'+'{{ secrets.'+name+' }}'));
 }
 assert.match(parts[1],/run: node server\/jalan\/audit-jalan-current-community-retention-readonly\.js/);
});
