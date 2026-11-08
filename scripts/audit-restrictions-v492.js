'use strict';
// node scripts/audit-restrictions-v492.js export-2.json [--report=restriction-review-v492.json]
// No MongoDB connection. The output report includes OSM relation details for review.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {build}=require('./import-network-v491');
const {inspect}=require('../server/jalan/restriction-v492');
const args=process.argv.slice(2);const file=args.find(x=>!x.startsWith('--'));const flags=args.filter(x=>x.startsWith('--'));
if(!file||args.filter(x=>!x.startsWith('--')).length!==1||flags.some(x=>!x.startsWith('--report='))){console.error('Usage: node scripts/audit-restrictions-v492.js export-2.json [--report=restriction-review-v492.json]');process.exit(1);}
const bytes=fs.readFileSync(path.resolve(file));const input=JSON.parse(bytes.toString('utf8'));const data=build(input);const report=inspect(input,data);
const summary={ok:true,mode:'DRY_RUN_V492',sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceVersion:input.osm3s?.timestamp_osm_base||'unversioned',roads:data.roads.length,nodes:data.nodeCoordinateCount,restrictionsParsed:data.restrictions.length,counts:report.counts,issuesTotal:report.issues.length,issuesSample:report.issues.slice(0,12).map(x=>({relationId:x.relationId,reasons:x.reasons,missing:x.missing,memberRoles:x.memberRoles})),reviewRequired:report.reviewRequired,databaseWrites:0,importAuthorized:false,note:'Read-only audit; do not run v491 --write until all issues are reviewed.'};
console.log(JSON.stringify(summary,null,2));
const target=flags.find(x=>x.startsWith('--report='));if(target){const dest=path.resolve(target.slice(9));if(dest===path.resolve(file))throw Error('Report must not overwrite source');fs.writeFileSync(dest,JSON.stringify({summary,issues:report.issues,conditionalRelations:report.valid.filter(x=>x.conditional)},null,2));console.log('Review report written: '+dest);}
