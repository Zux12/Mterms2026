'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const rows=require('./kl-restriction-review-sample-v4102.json');
const {assessRestrictionReview}=require('./kl-restriction-review-v4102');
test('real imported KL review sample is explicitly pending with no fabricated approvals',()=>{
 const r=assessRestrictionReview(rows);
 assert.equal(r.total,2);
 assert.equal(r.accepted,0);
 assert.equal(r.pending,2);
 assert.equal(r.productionRoutingAuthorized,false);
 assert.ok(rows.every(x=>x.status==='pending'&&x.evidenceRefs.length===0&&
  x.roadAccessChecked===false&&x.turnGeometryChecked===false));
});
