'use strict';
// Experimental GPS snapping diagnostics. A nearby alternate directed edge must
// remain visible as an ambiguity warning; this does not alter route selection.
const test=require('node:test');
const assert=require('node:assert/strict');
const {nearest,distance}=require('./kl-segment-v4102');
const edge=(id,a,b)=>({id,from:id+'-a',to:id+'-b',a,b,len:distance(a,b)});
const gps=[3.14,101.681];
test('parallel close roads are reported as potentially ambiguous',()=>{
 const main=edge('main',[3.14,101.68],[3.14,101.682]);
 const other=edge('parallel',[3.14003,101.68],[3.14003,101.682]);
 const far=edge('far',[3.144,101.68],[3.144,101.682]);
 const snap=nearest([far,other,main],gps);
 assert.equal(snap.edge.id,'main');
 assert.equal(snap.candidatesWithin200,2);
 assert.equal(snap.ambiguousSnap,true);
 assert.ok(snap.secondBestSnapMeters>0&&snap.secondBestSnapMeters<10);
});
test('single nearby edge reports no alternate road ambiguity',()=>{
 const near=edge('near',[3.14,101.68],[3.14,101.682]);
 const far=edge('far',[3.144,101.68],[3.144,101.682]);
 const snap=nearest([near,far],gps);
 assert.equal(snap.edge.id,'near');
 assert.equal(snap.candidatesWithin200,1);
 assert.equal(snap.ambiguousSnap,false);
 assert.ok(snap.secondBestSnapMeters>200);
});
test('two edges with equal GPS projection are flagged while first snap remains deterministic',()=>{
 const a=edge('a',[3.14,101.68],[3.14,101.682]);
 const b=edge('b',[3.14,101.682],[3.14,101.68]);
 const snap=nearest([a,b],gps);
 assert.equal(snap.edge.id,'a');
 assert.equal(snap.candidatesWithin200,2);
 assert.equal(snap.ambiguousSnap,true);
 assert.equal(snap.secondBestSnapMeters,0);
});
test('empty graph retains null result',()=>assert.equal(nearest([],gps),null));
