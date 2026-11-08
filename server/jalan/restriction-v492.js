'use strict';
// Read-only diagnostics. No database access, no routing modifications.
const express = require('express');
const router = express.Router();
function inspect(input, build) {
 if (!input || !Array.isArray(input.elements)) throw Error('Expected Overpass JSON elements');
 const roadIds = new Set(build.roads.map(x => x.roadId));
 const nodeIds = new Set(input.elements.filter(x=>x.type==='node').map(x=>String(x.id)));
 const counts={validResolvable:0,invalidStructure:0,unresolvedReferences:0,conditional:0,missingRestrictionTag:0};
 const issues=[]; const valid=[];
 for (const e of input.elements) {
  if(e.type!=='relation'||e.tags?.type!=='restriction') continue;
  const members=Array.isArray(e.members)?e.members:[];
  const from=members.filter(m=>m.role==='from'&&m.type==='way');
  const to=members.filter(m=>m.role==='to'&&m.type==='way');
  const via=members.filter(m=>m.role==='via'&&(m.type==='way'||m.type==='node'));
  const unknown=members.filter(m=>!((m.role==='from'&&m.type==='way')||(m.role==='to'&&m.type==='way')||(m.role==='via'&&(m.type==='way'||m.type==='node'))));
  const conditional=Object.keys(e.tags||{}).some(k=>k.startsWith('restriction:')&&k.endsWith(':conditional')||k==='restriction:conditional');
  if(conditional) counts.conditional++;
  const restriction=e.tags?.restriction||e.tags?.['restriction:motorcar']||e.tags?.['restriction:motor_vehicle']||'';
  if(!restriction) counts.missingRestrictionTag++;
  const reasons=[];
  if(!Number.isSafeInteger(e.id)||from.length!==1||to.length!==1||!via.length||unknown.length) reasons.push('invalid-structure');
  const missing=[];
  for(const m of [...from,...to,...via]){
   if(m.type==='way'&&!roadIds.has('osm-way-'+m.ref)) missing.push(m.role+':way:'+m.ref);
   if(m.type==='node'&&!nodeIds.has(String(m.ref))) missing.push(m.role+':node:'+m.ref);
  }
  if(missing.length) reasons.push('unresolved-reference');
  if(reasons.includes('invalid-structure')) counts.invalidStructure++;
  else if(reasons.includes('unresolved-reference')) counts.unresolvedReferences++;
  else counts.validResolvable++;
  const item={relationId:'osm-relation-'+e.id,restriction,conditional,reasons,missing,memberRoles:members.map(m=>`${m.role}:${m.type}`),members:members.map(m=>({type:m.type,role:m.role,ref:String(m.ref)})),tags:e.tags||{}};
  if(reasons.length)issues.push(item);else valid.push(item);
 }
 return {counts,issues,valid,reviewRequired:issues.length+counts.conditional>0};
}
function selfTest(){
 const base={roads:[{roadId:'osm-way-1'},{roadId:'osm-way-2'}]};
 const rel=(id,m,t={restriction:'no_left_turn',type:'restriction'})=>({type:'relation',id,members:m,tags:t});
 const a=[{type:'way',role:'from',ref:1},{type:'node',role:'via',ref:10},{type:'way',role:'to',ref:2}];
 const input={elements:[{type:'node',id:10},rel(1,a),rel(2,a.slice(0,2)),rel(3,[a[0],a[1],{type:'way',role:'to',ref:999}]),rel(4,a,{type:'restriction','restriction:conditional':'no_left_turn @ (Mo-Fr 07:00-09:00)'})]};
 const r=inspect(input,base);const tests=[['valid relation',r.counts.validResolvable===2],['invalid structure',r.counts.invalidStructure===1],['missing referenced road',r.counts.unresolvedReferences===1],['conditional preserved',r.counts.conditional===1],['issues retained',r.issues.length===2],['no database writes',true]];
 return {ok:tests.every(x=>x[1]),passed:tests.filter(x=>x[1]).length,total:tests.length,syntheticOnly:true,databaseWrites:0,tests:tests.map(([name,pass])=>({name,pass}))};
}
router.get('/health',(_req,res)=>res.json({ok:true,mode:'restriction-readiness-v4.9.2',readOnly:true,databaseWrites:0,liveTrafficUnchanged:true,importAuthorized:false}));
router.get('/self-test',(_req,res)=>{const r=selfTest();res.status(r.ok?200:500).json(r);});
module.exports={router,inspect,selfTest};
