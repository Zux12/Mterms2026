'use strict';
// Static browser-script syntax and basic DOM contract gate.
// Does not claim browser rendering or real-world navigation validation.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'kl-pilot-preview.html'),'utf8');
const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if(matches.length!==1)throw Error('Expected one inline pilot browser script');
new vm.Script(matches[0][1],{filename:'kl-pilot-preview-inline.js'});
for(const id of ['map','start','end','token','check','route','swap','status']){
 if(!new RegExp('id="'+id+'"').test(html))throw Error('Missing preview control '+id);
}
if(!html.includes('EXPERIMENTAL ONLY')||!html.includes('legalDrivingRouteVerified'))
 throw Error('Pilot safety warning or route safety gate missing');
process.stdout.write('KL pilot browser script parses and required controls exist.\n');
