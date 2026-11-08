'use strict';
const {matchRoads}=require('./real-road-matching');
function runTests(){const main={roadId:'main',name:'Main',highway:'primary',oneway:true,geometry:[[101.7,3.15],[101.701,3.15]]};const parallel={...main,roadId:'parallel',name:'Parallel',geometry:[[101.7,3.1501],[101.701,3.1501]]};const cases=[
['Exact road match',()=>matchRoads([main],3.15,101.7005,90,5).roadId==='main'],
['Wrong one-way direction rejected',()=>matchRoads([main],3.15,101.7005,270,5).status==='rejected'],
['Ambiguous parallel roads rejected',()=>matchRoads([main,parallel],3.15005,101.7005,90,8).status==='uncertain'],
['Poor accuracy rejected',()=>matchRoads([main],3.15,101.7005,90,30).status==='rejected'],
['Faraway road rejected',()=>matchRoads([main],3.16,101.7005,90,5).status==='rejected'],
['Two-way reverse direction allowed',()=>matchRoads([{...main,oneway:false}],3.15,101.7005,270,5).status==='matched'],
['Missing heading rejected',()=>matchRoads([main],3.15,101.7005,NaN,5).status==='rejected'],
['Zero-length geometry ignored',()=>matchRoads([{...main,geometry:[[101.7,3.15],[101.7,3.15]]}],3.15,101.7,90,5).status==='rejected'],
['Empty roads rejected',()=>matchRoads([],3.15,101.7,90,5).status==='rejected']];const tests=cases.map(([name,fn])=>{let pass=false;try{pass=fn();}catch(_){}return {name,pass};});return {ok:tests.every(t=>t.pass),passed:tests.filter(t=>t.pass).length,total:tests.length,syntheticOnly:true,databaseWrites:0,tests};}
module.exports={runTests};
