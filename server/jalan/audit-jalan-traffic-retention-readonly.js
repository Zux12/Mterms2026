'use strict';
// Metadata-only review of the existing opt-in traffic storage TTL index.
// No observation documents, query coordinates, session IDs or Heroku secrets read.
const {MongoClient}=require('mongodb');
const EXPECTED=900;
function isIsolatedReadOnlyUri(uri){
 if(typeof uri!=='string'||!uri)return false;
 try{
  const parsed=new URL(uri);
  return ['mongodb:','mongodb+srv:'].includes(parsed.protocol)
    && decodeURIComponent(parsed.username)==='jalan_readonly';
 }catch{return false;}
}
function evaluate(indexes){
 if(!Array.isArray(indexes))throw Error('invalid-index-metadata');
 const ttl=indexes.filter(x=>Number.isInteger(x?.expireAfterSeconds));
 const matches=ttl.filter(x=>x.expireAfterSeconds===EXPECTED
   && x.key&&Object.keys(x.key).length===1&&x.key.at===1);
 return {ok:matches.length===1,ttlIndexPresent:matches.length===1,
  expectedRetentionSeconds:EXPECTED,ttlIndexesObserved:ttl.length};
}
async function audit({uri=process.env.JALAN_READONLY_MONGODB_URI,
 connect=u=>new MongoClient(u,{serverSelectionTimeoutMS:15000,
  readPreference:'secondaryPreferred'}),log=console.log}={}){
 if(!isIsolatedReadOnlyUri(uri))throw Error('isolated-readonly-credential-required');
 const client=connect(uri);
 try{
  await client.connect();
  // listIndexes only: not find, aggregate, insert, update, delete or createIndex.
  const indexes=await client.db('jalan_navigation')
   .collection('traffic_observations').listIndexes().toArray();
  const result=evaluate(indexes);
  log('JALAN opt-in observation retention index metadata: '+
    JSON.stringify(result));
  log('Read-only metadata only; TTL index presence does not prove actual purge latency.');
  if(!result.ok)throw Error('observation-retention-index-not-verified');
  return result;
 }finally{await client.close();}
}
if(require.main===module)audit().catch(()=>{
 console.error('JALAN traffic retention metadata NOT verified (details suppressed).');
 process.exitCode=1;
});
module.exports={EXPECTED,isIsolatedReadOnlyUri,evaluate,audit};
