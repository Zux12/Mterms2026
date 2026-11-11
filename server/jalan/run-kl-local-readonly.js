'use strict';
// Operator-only local KL full-graph route runner. No Heroku deployment, no DB writes.
// Requires a separately provisioned READ-ONLY MongoDB credential.
// Input JSON is private; only sanitized evidence is written (mode 0600).
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const express=require('express'),mongoose=require('mongoose');
const {router}=require('./kl-segment-v4102');
const {collectEvidence,validateCases}=require('./collect-kl-route-evidence');
async function main(){
 const [input,output]=process.argv.slice(2);
 if(!input||!output||path.resolve(input)===path.resolve(output))
  throw Error('Provide distinct private case input and sanitized output paths');
 if(!process.env.JALAN_READONLY_MONGODB_URI)
  throw Error('A read-only MongoDB connection is required');
 const cases=validateCases(JSON.parse(fs.readFileSync(input,'utf8')));
 const app=express();
 // This preview is never exposed to the network or production application.
 app.use('/api/jalan/kl',router);
 let server;
 try{
  await mongoose.connect(process.env.JALAN_READONLY_MONGODB_URI,{
   serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'
  });
  server=await new Promise((resolve,reject)=>{
   const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject);
  });
  const port=server.address().port;
  const evidence=await collectEvidence(cases,`http://127.0.0.1:${port}/api/jalan/kl/route`,{
   timeoutMs:60000
  });
  fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n',{flag:'wx',mode:0o600});
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
 process.stderr.write('Local KL route run failed; check private input, read-only DB access and local dependencies.\n');
 process.exitCode=1;
});
