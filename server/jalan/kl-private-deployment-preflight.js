'use strict';
// Strict offline preflight for a future separate private deployment.
// Never deploys, connects to a database, or prints secret values.
const fs=require('node:fs');
const path=require('node:path');
function preflight(config){
 const issues=[];
 if(!config||typeof config!=='object'||Array.isArray(config))
  return {ready:false,issues:['Missing deployment configuration'],productionRoutingAuthorized:false};
 const required=['separateService','separateCredentials','readOnlyDatabase','httpsOnly',
  'privatePageAuthentication','privateApiAuthentication','secretsManager',
  'requestRateLimits','routeConcurrencyLimit','noCoordinateLogging',
  'healthAndFailureHandling','externalPilotDiagnosticOnly'];
 for(const key of required)if(config[key]!==true)issues.push('Unverified gate: '+key);
 if(config.productionServiceModified!==false)issues.push('Production isolation not demonstrated');
 if(config.turnRestrictionsEnforced!==false)issues.push('Turn enforcement must remain disabled');
 if(config.publicDrivingDirectionsEnabled!==false)issues.push('Public driving directions must remain disabled');
 if(config.databaseWritesEnabled!==false)issues.push('Database writes must remain disabled');
 if(config.previewMode!=='EXPERIMENTAL_SEGMENT_ROUTE')
  issues.push('Unexpected preview mode');
 return {ready:issues.length===0,issues,productionRoutingAuthorized:false,
  externalDrivingNavigationAuthorized:false};
}
if(require.main===module){
 const file=process.argv[2];
 if(!file)throw Error('Provide private deployment checklist JSON file path');
 const result=preflight(JSON.parse(fs.readFileSync(path.resolve(file),'utf8')));
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(!result.ready)process.exitCode=2;
}
module.exports={preflight};
