'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {
  publicationEligibility,verifiedBylineAuthor,validHttpsUrl,normalizedName,thresholdFor
}=require('../server/oilandgas/recognition-policy');
const sample={
 kind:'publications',reference:'OG-P-1234567890ABCDEF',
 title:'Investigating corrosion in offshore gas pipelines',
 byline:'Nur A. Rahman, John Smith, A. Lee',
 source:'https://doi.org/10.1000/xyz',publishedAt:'2026-10-01T00:00:00.000Z'
};
test('only published-source-backed research documents qualify',()=>{
 assert.deepEqual(publicationEligibility(sample),{eligible:true,reasons:[]});
 assert.equal(publicationEligibility({...sample,source:''}).eligible,false);
 assert.equal(publicationEligibility({...sample,kind:'articles'}).eligible,false);
 assert.equal(publicationEligibility({...sample,source:'http://doi.org/10.1000/xyz'}).eligible,false);
});
test('integrity hold prevents selection',()=>{
 for(const state of ['retracted','withdrawn','disputed']){
  const result=publicationEligibility({...sample,integrityStatus:state});
  assert.equal(result.eligible,false);
  assert.ok(result.reasons.includes('integrity-hold'));
 }
});
test('coauthor name must match a published byline token',()=>{
 assert.equal(verifiedBylineAuthor(sample,'John Smith'),true);
 assert.equal(verifiedBylineAuthor(sample,'john   smith'),true);
 assert.equal(verifiedBylineAuthor(sample,'Random Person'),false);
 assert.equal(normalizedName('  A.  Lee  '),'a. lee');
});
test('categories enforce different minimum scores',()=>{
 assert.equal(thresholdFor('editors-pick'),85);
 assert.equal(thresholdFor('industry-impact'),75);
 assert.equal(thresholdFor('emerging-research'),75);
});
test('source URL cannot point to insecure or internal site',()=>{
 assert.equal(validHttpsUrl('https://doi.org/10.1234/ok'),true);
 assert.equal(validHttpsUrl('https://localhost/secret'),false);
 assert.equal(validHttpsUrl('http://example.com'),false);
 assert.equal(validHttpsUrl('https://user:pass@example.com/'),false);
});
test('recognition module requires separate activation flag and no mail transport',()=>{
 const fs=require('node:fs');
 const s=fs.readFileSync(require.resolve('../server/oilandgas/recognition'),'utf8');
 assert.match(s,/OIL_RECOGNITION_ACTIVATION_ENABLED/);
 assert.doesNotMatch(s,/sendMail\s*\(|createTransport\s*\(/);
});
