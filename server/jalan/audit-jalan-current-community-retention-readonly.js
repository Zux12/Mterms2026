'use strict';
// Source-scoped, metadata-only check of the CURRENT JALAN community reporting
// collections. Not the retired traffic_observations.at 900-second audit.
// Do not read data documents, user coordinates, config values or any other DB.
const {MongoClient}=require('mongodb');
const {isIsolatedReadOnlyUri}=require('./audit-jalan-traffic-retention-readonly');

const DB='jalan_navigation';
const COLLECTIONS=Object.freeze(['community_flow_segments','community_report_buckets']);

function evaluate(indexes){
 if(!Array.isArray(indexes))throw Error('invalid-index-metadata');
 const ttl=indexes.filter(i=>Number.isInteger(i?.expireAfterSeconds));
 const exact=ttl.filter(i=>i.expireAfterSeconds===0 && i.key &&
  Object.keys(i.key).length===1 && i.key.expiresAt===1 &&
  // A partial TTL index deletes ONLY matching documents; it cannot prove
  // retention for the entire flow/report collection (MongoDB docs).
  !Object.prototype.hasOwnProperty.call(i,'partialFilterExpression') &&
  i.sparse!==true);
 return {ttlZeroExpiryIndex:exact.length===1,ttlIndexCount:ttl.length};
}

async function audit({uri=process.env.JALAN_READONLY_MONGODB_URI,
 connect=u=>new MongoClient(u,{serverSelectionTimeoutMS:15000,
  readPreference:'secondaryPreferred'}),log=console.log}={}){
 if(!isIsolatedReadOnlyUri(uri))throw Error('isolated-readonly-credential-required');
 const client=connect(uri);
 try{
  await client.connect();
  const db=client.db(DB);
  const summary={};
  for(const name of COLLECTIONS){
   // Never use find/countDocuments/aggregate or a write operation.
   const indexes=await db.collection(name).listIndexes().toArray();
   summary[name]=evaluate(indexes);
  }
  const ok=COLLECTIONS.every(name=>summary[name].ttlZeroExpiryIndex);
  log('JALAN current report collection index-only audit: '+JSON.stringify({ok,collections:summary}));
  log('TTL index presence is not physical purge timing, app-to-cluster identity, historical erasure or consent compliance.');
  if(!ok)throw Error('current-community-retention-index-not-verified');
  return {ok,collections:summary};
 }finally{await client.close();}
}
if(require.main===module)audit().catch(()=>{
 console.error('JALAN current report TTL metadata NOT verified; no document data was read.');
 process.exitCode=1;
});
module.exports={DB,COLLECTIONS,evaluate,audit};
