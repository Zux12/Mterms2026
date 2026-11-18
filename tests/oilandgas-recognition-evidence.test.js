'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validatePacket,availableEvidence,evidenceForModel}=require('../server/oilandgas/recognition-evidence');
const packet={sourceReviewed:true,evidenceUrl:'https://doi.org/10.1000/abc',
 methodology:'Controlled study using repeated tests on representative industrial materials under documented conditions.',
 results:'The reported findings describe comparative changes between baseline and intervention samples.',
 limitations:'The evidence is constrained by a narrow field sample and additional independent verification is necessary.',
 industryImplications:'The results could inform site reliability practices if independently validated under operating conditions.'};
test('complete source-backed evidence is required',()=>{
 const result=validatePacket(packet);assert.equal(result.valid,true);
 assert.equal(availableEvidence({status:'verified',revision:'r1',packet:result.packet},'r1'),true);
 assert.equal(availableEvidence({status:'verified',revision:'r1',packet:result.packet},'r2'),false);
});
test('title and summary cannot stand in for methodology and results',()=>{
 const result=validatePacket({sourceReviewed:true,evidenceUrl:packet.evidenceUrl});
 assert.equal(result.valid,false);assert.ok(result.issues.length>=4);
});
test('invalid or unverified evidence is held pending',()=>{
 assert.equal(validatePacket({...packet,sourceReviewed:false}).valid,false);
 assert.equal(validatePacket({...packet,evidenceUrl:'http://example.com/paper'}).valid,false);
 assert.equal(validatePacket({...packet,limitations:'none'}).valid,false);
});
test('AI prompt receives bounded evidence fields',()=>{
 const result=validatePacket(packet);assert.deepEqual(Object.keys(evidenceForModel({packet:result.packet})),
  ['methodology','results','limitations','industryImplications']);
});
