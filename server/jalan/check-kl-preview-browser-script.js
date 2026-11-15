'use strict';
// Static browser-script syntax and basic DOM contract gate.
// Does not claim browser rendering or real-world navigation validation.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'kl-pilot-preview.html'),'utf8');
const matches=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
const inline=matches.filter(m=>!/(?:^|\s)src\s*=/.test(m[1]));
if(inline.length!==1)throw Error('Expected one inline pilot browser script');
new vm.Script(inline[0][2],{filename:'kl-pilot-preview-inline.js'});

/*
 * The browser holds the private preview token and optional one-shot GPS point.
 * A swapped third-party Leaflet script could read both, so require the exact
 * audited public Pages v1.9.4 hashes here as well. No unpinned remote
 * scripts or stylesheets may be introduced without a separate review.
 */
const remoteScripts=[...html.matchAll(/<script\b[^>]*\bsrc="https?:\/\/[^"]+"[^>]*><\/script>/gi)].map(m=>m[0]);
const remoteCss=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="https?:\/\/[^"]+"[^>]*>/gi)].map(m=>m[0]);
const expected=[
 [remoteScripts,'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='],
 [remoteCss,'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=']
];
for(const [tags,url,sri] of expected){
 if(tags.length!==1||!tags[0].includes('="'+url+'"')||
   !tags[0].includes('integrity="'+sri+'"')||
   !tags[0].includes('crossorigin="anonymous"'))
  throw Error('Private preview requires pinned cross-origin Leaflet integrity: '+url);
}

for(const id of ['map','start','end','token','check','route','swap','status']){
 if(!new RegExp('id="'+id+'"').test(html))throw Error('Missing preview control '+id);
}
if(!html.includes('EXPERIMENTAL ONLY')||!html.includes('legalDrivingRouteVerified'))
 throw Error('Pilot safety warning or route safety gate missing');
for(const diagnostic of ['Start-to-road snap:', 'Destination-to-road snap:',
 'endSnapMeters', 'startSnapAmbiguous', 'endSnapAmbiguous', 'Arrival caution:',
 'Legal driving route verified: NO']){
 if(!html.includes(diagnostic))throw Error('Missing private route snap/access safety diagnostic: '+diagnostic);
}
process.stdout.write('KL pilot browser script parses and required controls exist.\n');
