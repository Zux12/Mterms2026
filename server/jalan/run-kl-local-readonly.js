'use strict';
// Operator-only local KL full-graph route runner. No Heroku deployment, no DB writes.
// Requires a separately provisioned READ-ONLY MongoDB credential.
// Input JSON is private; only sanitized evidence is written (mode 0600).
const fs=require('node:fs'),path=require('node:path');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const express=require('express'),mongoose=require('mongoose');
const {router}=require('./kl-segment-v4102');
const {collectEvidence,validateCases}=require('./collect-kl-route-evidence');
let failureStage='initialization';
async function main(){
 const [input,output]=process.argv.slice(2);
 if(!input||!output||path.resolve(input)===path.resolve(output))
  throw Error('Provide distinct private case input and sanitized output paths');
 if(!process.env.JALAN_READONLY_MONGODB_URI)
  throw Error('A read-only MongoDB connection is required');
 failureStage='input-validation';
 const cases=validateCases(JSON.parse(fs.readFileSync(input,'utf8')));
 const app=express();
 // Ephemeral per-run token prevents other local processes from casually
 // querying private journey coordinates through the loopback preview.
 const sessionToken=randomBytes(32).toString('hex');
 app.use('/api/jalan/kl',(req,res,next)=>{
  const received=req.get('x-jalan-local-session');
  const expected=Buffer.from(sessionToken);
  const candidate=typeof received==='string'?Buffer.from(received):Buffer.alloc(0);
  if(candidate.length!==expected.length||!timingSafeEqual(candidate,expected))
   return res.status(401).json({ok:false,error:'Unauthorized'});
  next();
 },router);
 let server;
 try{
  failureStage='mongodb-connect';
  await mongoose.connect(process.env.JALAN_READONLY_MONGODB_URI,{
   serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'
  });
  // Fail closed before opening the loopback endpoint if the complete
  // expected imported graph is unavailable. This is a count check, not
  // proof of road legality or a transactionally consistent snapshot.
  failureStage='graph-count';
  const edgeCount=await mongoose.connection.useDb('jalan_navigation',{useCache:true})
   .db.collection('road_graph_edges_v495').countDocuments();
  if(edgeCount!==168221)throw Error('Incomplete KL graph');
  failureStage='loopback-listen';
  server=await new Promise((resolve,reject)=>{
   const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);
  });
  const port=server.address().port;
  // The first valid route request measures a cold load; subsequent requests
  // should observe the cached graph. This runner deliberately remains sequential.
  failureStage='route-collection';
  const evidence=await collectEvidence(cases,`http://127.0.0.1:${port}/api/jalan/kl/route`,{
   timeoutMs:60000,authHeader:'x-jalan-local-session',authValue:sessionToken
  });
  failureStage='evidence-write';
  fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
  failureStage='evidence-validation';
  const checked=spawnSync(process.execPath,[path.join(__dirname,'validate-kl-pilot.js'),output],{
   encoding:'utf8',timeout:10000
  });
  if(checked.stdout)process.stdout.write(checked.stdout);
  if(checked.stderr)process.stderr.write('Validation checker reported an error.\n');
  process.exitCode=checked.status===null?1:checked.status;
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await mongoose.disconnect();
 }
}
if(require.main===module)main().catch(()=>{
 // Do not print MongoDB URIs, private coordinates, request URLs or stack traces.
 process.stderr.write('Local KL route run failed at stage: '+failureStage+' (details suppressed).\n');
 process.exitCode=1;
});
