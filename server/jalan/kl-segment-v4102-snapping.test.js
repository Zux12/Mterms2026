'use strict';
// Isolated tests: GPS snap candidates must consider segment envelopes, not only endpoint proximity.
const test=require('node:test');
const assert=require('node:assert/strict');
const {nearest,distance}=require('./kl-segment-v4102');
function edge(id,a,b){return {id,from:id+'-a',to:id+'-b',a,b,len:distance(a,b)};}
test('finds a long directed segment crossing the GPS location even when both endpoints are far',()=>{
 const long=edge('crossing',[3.13,101.67],[3.15,101.69]);
 const snap=nearest([long],[3.14,101.68]);
 assert.ok(snap,'the middle of a long crossing segment must remain a candidate');
 assert.equal(snap.edge.id,'crossing');
 assert.ok(Math.abs(snap.t-0.5)<0.0001);
 assert.ok(snap.meters<1);
});
test('chooses closest segment by projected distance, not input order',()=>{
 const offset=edge('offset',[3.1306,101.67],[3.1506,101.69]);
 const center=edge('center',[3.13,101.67],[3.15,101.69]);
 const snap=nearest([offset,center],[3.14,101.68]);
 assert.ok(snap);
 assert.equal(snap.edge.id,'center');
 assert.ok(snap.meters<1);
});
test('returns no candidate for empty graph or segments outside search envelope',()=>{
 const far=edge('far',[2.8,101.2],[2.801,101.201]);
 assert.equal(nearest([],[3.14,101.68]),null);
 assert.equal(nearest([far],[3.14,101.68]),null);
});
