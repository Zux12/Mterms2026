'use strict';
// Offline independent OSM endpoint evidence validator. No network or DB access.
// Never convert a missing source or an OSM tag into a legal-driving verdict.
const CLASSES=new Set(['legitimate-one-way-or-dead-end','extract-boundary','suspected-import-gap','unresolved']);
function reviewEndpoint(record){
 const errors=[];
 if(!record||typeof record!=='object'||Array.isArray(record))return {accepted:false,errors:['Expected review object'],roadLegalityVerified:false};
 if(!/^\d+$/.test(String(record.nodeId||'')))errors.push('Invalid OSM node ID');
 if(!['source-only','sink-only'].includes(record.importedClass))errors.push('Invalid endpoint class');
 if(!Number.isInteger(record.incoming)||record.incoming<0||!Number.isInteger(record.outgoing)||record.outgoing<0)errors.push('Invalid directed degree');
 else if(record.importedClass==='source-only'&&(record.incoming!==0||record.outgoing===0)||
         record.importedClass==='sink-only'&&(record.outgoing!==0||record.incoming===0))errors.push('Degree conflicts with endpoint class');
 if(!Array.isArray(record.parentWayIds)||!record.parentWayIds.length||!record.parentWayIds.every(x=>/^\d+$/.test(String(x))))errors.push('Missing independent parent-way IDs');
 if(typeof record.evidenceSource!=='string'||!/^https:\/\//.test(record.evidenceSource))errors.push('Missing HTTPS evidence source');
 if(typeof record.evidenceRetrievedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(record.evidenceRetrievedAt)||!Number.isFinite(Date.parse(record.evidenceRetrievedAt)))errors.push('Missing evidence retrieval timestamp');
 if(!CLASSES.has(record.classification))errors.push('Invalid classification');
 if(typeof record.reason!=='string'||record.reason.trim().length<30)errors.push('Insufficient independent review rationale');
 if(record.classification==='suspected-import-gap'&&(!record.confirmationSource||!/^https:\/\//.test(record.confirmationSource)))errors.push('Suspected import gap requires second independent source');
 return {accepted:errors.length===0,errors,roadLegalityVerified:false,productionRoutingAuthorized:false};
}
module.exports={reviewEndpoint};
