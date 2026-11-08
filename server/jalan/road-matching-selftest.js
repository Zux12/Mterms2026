'use strict';
const {matchRoad}=require('./road-matching');
function runTests(){
 const roads=[
  {id:'main-east',oneway:true,geometry:[[3.14000,101.68000],[3.14000,101.68500]]},
  {id:'service-east',oneway:true,geometry:[[3.14035,101.68000],[3.14035,101.68500]]},
  {id:'westbound',oneway:true,geometry:[[3.13970,101.68500],[3.13970,101.68000]]}
 ];
 const cases=[
  ['Correct main road',{position:[3.14000,101.68200],heading:90,accuracy:5},'matched','main-east'],
  ['Correct parallel service road',{position:[3.14035,101.68200],heading:90,accuracy:5},'matched','service-east'],
  ['Opposite carriageway',{position:[3.13970,101.68200],heading:270,accuracy:5},'matched','westbound'],
  ['Ambiguous midpoint rejected',{position:[3.140175,101.68200],heading:90,accuracy:5},'uncertain'],
  ['Poor GPS rejected',{position:[3.14000,101.68200],heading:90,accuracy:40},'rejected'],
  ['Wrong travel direction rejected',{position:[3.14000,101.68200],heading:270,accuracy:5},'rejected'],
  ['No compatible road',{position:[3.15000,101.68200],heading:90,accuracy:5},'rejected'],
  ['Missing heading rejected',{position:[3.14000,101.68200],heading:null,accuracy:5},'rejected']
 ];
 const tests=cases.map(([name,fix,status,id])=>{const r=matchRoad(fix,roads);return {name,pass:r.status===status&&(!id||r.roadId===id),result:r};});
 // At grade-separated crossings, identical 2D positions cannot establish the correct road.
 const crossing=[{id:'bridge',oneway:true,geometry:[[3.14,101.68],[3.14,101.685]]},{id:'surface',oneway:true,geometry:[[3.14,101.68],[3.14,101.685]]}];
 const r=matchRoad({position:[3.14,101.682],heading:90,accuracy:5},crossing);
 tests.push({name:'Overlapping flyover geometry remains uncertain',pass:r.status==='uncertain',result:r});
 return {ok:tests.every(t=>t.pass),passed:tests.filter(t=>t.pass).length,total:tests.length,syntheticOnly:true,databaseWrites:0,tests};
}
module.exports={runTests};
if(require.main===module){const r=runTests();console.log(JSON.stringify(r,null,2));if(!r.ok)process.exitCode=1;}
