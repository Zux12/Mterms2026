'use strict';
// Read-only, reproducible KL pilot validation output checker.
// Usage: node server/jalan/validate-kl-pilot.js path/to/cases.json
// This script never contacts MongoDB or a live API.
const fs=require('node:fs');
const cases=JSON.parse(fs.readFileSync(process.argv[2]||'', 'utf8'));
if(!Array.isArray(cases)||cases.length===0)throw Error('Expected a nonempty JSON array');
const failures=[],seen=new Set(),snap=[];
for(const [i,c] of cases.entries()){
 const id=String(c.caseId||'');
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||seen.has(id))failures.push('case '+i+': invalid or duplicate ID');
 seen.add(id);
 if(typeof c.ok!=='boolean')failures.push(id+': missing ok boolean');
 if(!Number.isFinite(c.elapsedMs)||c.elapsedMs<0)failures.push(id+': invalid elapsedMs');
 if(c.ok){
  if(!Number.isFinite(c.distanceMeters)||c.distanceMeters<0)failures.push(id+': invalid distanceMeters');
  for(const k of ['startSnapMeters','endSnapMeters']){
   if(!Number.isFinite(c[k])||c[k]<0)failures.push(id+': invalid '+k);
   else snap.push(c[k]);
  }
  if(c.geometryContinuous!==true)failures.push(id+': geometry continuity not verified');
 }
}
snap.sort((a,b)=>a-b);
const quantile=p=>snap.length?snap[Math.ceil(p*snap.length)-1]:null;
const summary={cases:cases.length,successful:cases.filter(c=>c.ok).length,failed:cases.filter(c=>c.ok===false).length,
 snapMedianMeters:quantile(.5),snapP95Meters:quantile(.95),snapMaxMeters:quantile(1),
 snapOver200Meters:snap.filter(x=>x>200).length,validationErrors:failures};
console.log(JSON.stringify(summary,null,2));
if(failures.length)process.exitCode=1;
