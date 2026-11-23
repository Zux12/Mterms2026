'use strict';
// Original Mterms community reports use the original app's MTERM2026_DB_URI.
// The JALAN graph read-only secret is NOT evidence of the same datastore.
// Before even CONNECTING, bind it to the independently approved immutable
// original Heroku app UUID and its deployed Mongo endpoint via GET-only API.
// No config values, database documents, coordinates or identifiers are logged.
const {MongoClient}=require('mongodb');
const {isIsolatedReadOnlyUri}=require('./audit-jalan-traffic-retention-readonly');

const DB='jalan_navigation';
const COLLECTIONS=Object.freeze(['community_flow_segments','community_report_buckets']);
const ORIGINAL_NAMES=new Set(['mterm2026','mterms2026']);
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function mongoEndpoint(uri){
 try{
  const u=new URL(uri);
  if(!['mongodb:','mongodb+srv:'].includes(u.protocol)||!u.host||!u.username)
   throw Error('invalid-mongodb-endpoint');
  // Host/seed set and scheme only; credentials and app's default DB may differ.
  return u.protocol+'//'+u.host.toLowerCase();
 }catch{throw Error('invalid-mongodb-endpoint');}
}
async function verifyOriginalBinding({uri,expectedAppId,key,fetcher=fetch}){
 if(typeof expectedAppId!=='string'||!UUID.test(expectedAppId))
  throw Error('independently-approved-original-app-uuid-required');
 if(typeof key!=='string'||key.length<16)
  throw Error('protected-heroku-readonly-auth-required');
 const headers={Authorization:'Bearer '+key,
  Accept:'application/vnd.heroku+json; version=3'};
 const base='https://api.heroku.com/apps/'+encodeURIComponent(expectedAppId);
 async function get(path){
  const r=await fetcher(base+path,{method:'GET',headers,redirect:'error',
   signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('original-app-readonly-identity-http-'+r.status);
  return r.json();
 }
 // Only immutable-ID paths: never route a credentialled request by app name.
 const app=await get('');
 if(typeof app?.id!=='string'||app.id.toLowerCase()!==expectedAppId.toLowerCase()||
    !ORIGINAL_NAMES.has(app.name))throw Error('original-app-identity-not-approved');
 const config=await get('/config-vars');
 if(typeof config?.MTERM2026_DB_URI!=='string'||
    mongoEndpoint(config.MTERM2026_DB_URI)!==mongoEndpoint(uri))
  throw Error('original-app-datastore-host-mismatch');
 return true;
}
function evaluate(indexes){
 if(!Array.isArray(indexes))throw Error('invalid-index-metadata');
 const ttl=indexes.filter(i=>Number.isInteger(i?.expireAfterSeconds));
 const exact=ttl.filter(i=>i.expireAfterSeconds===0 && i.key &&
  Object.keys(i.key).length===1 && i.key.expiresAt===1 &&
  // A partial TTL index deletes only matching documents, not the collection.
  !Object.prototype.hasOwnProperty.call(i,'partialFilterExpression') &&
  i.sparse!==true);
 return {ttlZeroExpiryIndex:exact.length===1,ttlIndexCount:ttl.length};
}
async function audit({uri=process.env.JALAN_READONLY_MONGODB_URI,
 expectedAppId=process.env.JALAN_EXPECTED_ORIGINAL_APP_ID,
 key=process.env.HEROKU_API_KEY,fetcher=fetch,
 connect=u=>new MongoClient(u,{serverSelectionTimeoutMS:15000,
  readPreference:'secondaryPreferred'}),log=console.log}={}){
 if(!isIsolatedReadOnlyUri(uri))throw Error('isolated-readonly-credential-required');
 // Refuse a guessed Atlas project or an unpinned mutable original app name.
 await verifyOriginalBinding({uri,expectedAppId,key,fetcher});
 const client=connect(uri);
 try{
  await client.connect();
  const db=client.db(DB),summary={};
  for(const name of COLLECTIONS){
   // No find/countDocuments/aggregate, no config or document writes.
   const indexes=await db.collection(name).listIndexes().toArray();
   summary[name]=evaluate(indexes);
  }
  const ok=COLLECTIONS.every(name=>summary[name].ttlZeroExpiryIndex);
  log('Original-app-bound current JALAN index-only audit: '+JSON.stringify({ok,collections:summary}));
  log('Binding and TTL metadata do not prove application deployment, physical purge timing, historical erasure or consent compliance.');
  if(!ok)throw Error('current-community-retention-index-not-verified');
  return {ok,collections:summary};
 }finally{await client.close();}
}
if(require.main===module)audit().catch(()=>{
 console.error('Original-app-bound current JALAN TTL metadata NOT verified; no database documents were read.');
 process.exitCode=1;
});
module.exports={DB,COLLECTIONS,mongoEndpoint,verifyOriginalBinding,evaluate,audit};
