'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {currentLetterStatus,officialVerificationUrl}=require('../server/oilandgas/recognition-letter-verification');
test('QR contains official site and individual letter ID, never tracking secrets',()=>{
 const id='OG-WRS-ABCDEF1234567890ABCDEF12';
 const link=new URL(officialVerificationUrl(id));
 assert.equal(link.origin,'https://oilandgas.eu.com');
 assert.equal(link.pathname,'/verify-letter.html');
 assert.equal(link.searchParams.get('id'),id);
 assert.equal(link.searchParams.has('visit'),false);
});
test('unknown, invalid and withdrawn letters never show a valid QR scan result',()=>{
 assert.equal(currentLetterStatus(null,null),'not-found');
 assert.equal(currentLetterStatus({status:'valid'},null),'invalid');
 assert.equal(currentLetterStatus({status:'valid'},{status:'withdrawn'}),'withdrawn');
 assert.equal(currentLetterStatus({status:'withdrawn'},{status:'active'}),'withdrawn');
 assert.equal(currentLetterStatus({status:'valid'},{status:'deleted'}),'invalid');
 assert.equal(currentLetterStatus({status:'pending'},{status:'active'}),'invalid');
});
test('valid letters remain verifiable while parent recognition is active or archived',()=>{
 assert.equal(currentLetterStatus({status:'valid'},{status:'active'}),'valid');
 assert.equal(currentLetterStatus({status:'valid'},{status:'archived'}),'valid');
});
test('reject malformed or unsafe verification references',()=>{
 for(const ref of ['','OG-WRS-','OG-WRS-ABC?x=1','../etc','OG-WRS-<script>']){
  assert.throws(()=>officialVerificationUrl(ref));
 }
});
test('official QR service reads current parent status rather than trusting letter alone',()=>{
 const backend=fs.readFileSync(path.join(__dirname,'../server/oilandgas/recognition.js'),'utf8');
 assert.match(backend,/recognition_selections'\)\.findOne\(\{_id:row\.selectionId\}/);
 assert.match(backend,/letterVerification\.currentLetterStatus\(row,recognition\)/);
 assert.match(backend,/Cache-Control','no-store'/);
});
