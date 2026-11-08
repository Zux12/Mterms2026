'use strict';
const {aggregateObservations,WINDOW_MS}=require('./aggregation');
function runTests(){
  const end=20*WINDOW_MS;
  const obs=(session,speed,win,extra={})=>({cell:'demo:cell',direction:2,speed,sessionHash:session,at:new Date(end-(win===0?3:1)*WINDOW_MS/2),...extra});
  const tests=[];
  const check=(name,condition)=>tests.push({name,pass:!!condition});
  const base=[obs('A',10,0),obs('B',12,0),obs('C',14,0),obs('A',9,1),obs('B',11,1),obs('C',13,1)];
  const a=aggregateObservations(base,end);
  check('Three independent drivers across both windows',a.length===1&&a[0].contributors===3&&a[0].evidence==='sustained-low-speed');
  const repeated=aggregateObservations([...base,obs('A',10,1),obs('A',10,1),obs('A',10,1)],end);
  check('Repeated readings do not increase contributor count',repeated.length===1&&repeated[0].contributors===3&&repeated[0].observations===6);
  check('Median of session medians',a[0]?.medianSpeedKmh===11);
  const sparse=aggregateObservations(base.filter(x=>x.sessionHash==='A'),end);
  check('One driver cannot establish multi-driver evidence',sparse.length===0);
  const oneWindow=aggregateObservations(base.filter(x=>x.at.getTime()>=end-WINDOW_MS),end);
  check('One populated window is insufficient history',oneWindow[0]?.evidence==='insufficient-history');
  const fast=aggregateObservations(base.map(x=>({...x,speed:55})),end);
  check('Normal speed does not count as sustained low speed',fast[0]?.evidence==='no-sustained-low-speed');
  const otherDirection=aggregateObservations([...base,obs('D',8,1,{direction:3})],end);
  check('Other directions remain separate',otherDirection[0]?.contributors===3);
  const otherCell=aggregateObservations([...base,obs('D',8,1,{cell:'other:cell'})],end);
  check('Other grid cells remain separate',otherCell[0]?.contributors===3);
  const future=aggregateObservations([...base,obs('D',1,1,{at:new Date(end+1000)})],end);
  check('Future and incomplete-window observations ignored',future[0]?.contributors===3);
  return {ok:tests.every(t=>t.pass),passed:tests.filter(t=>t.pass).length,total:tests.length,tests,syntheticOnly:true,databaseWrites:0};
}
module.exports={runTests};
if(require.main===module){const r=runTests();console.log(JSON.stringify(r,null,2));if(!r.ok)process.exitCode=1;}
