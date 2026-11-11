'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditEndpointCandidates:audit}=require('./kl-endpoint-review-v4102');
const {auditDirectedGraphTopology:topology}=require('./kl-graph-topology-audit-v4102');
const edge=(from,to,a=[3.14,101.68],b=[3.14,101.681])=>({from,to,a,b});

test('source-only and sink-only one-way endpoints are review candidates, not defects',()=>{
 const r=audit([edge('A','B'),edge('B','C')]);
 assert.equal(r.endpointReviewAvailable,true);
 assert.equal(r.endpointReviewSourceOnlyCount,1);
 assert.equal(r.endpointReviewSinkOnlyCount,1);
 assert.equal(r.endpointReviewSourceCandidates[0].nodeId,'A');
 assert.equal(r.endpointReviewSinkCandidates[0].nodeId,'C');
 assert.deepEqual(r.endpointReviewSourceCandidates[0].point,[3.14,101.68]);
 assert.equal(r.endpointReviewAdvisoryOnly,true);
 assert.equal(r.legalDrivingRouteVerified,false);
});
test('two-way cycles and self-loops have no one-sided endpoint candidates',()=>{
 const r=audit([edge('A','B'),edge('B','A'),edge('C','C')]);
 assert.equal(r.endpointReviewSourceOnlyCount,0);
 assert.equal(r.endpointReviewSinkOnlyCount,0);
 assert.deepEqual(r.endpointReviewSourceCandidates,[]);
 assert.deepEqual(r.endpointReviewSinkCandidates,[]);
});
test('candidate sorting prioritizes degree and uses stable tie-breaking',()=>{
 const r=audit([edge('A','X'),edge('B','X'),edge('B','Y'),
  edge('A','Y'),edge('C','Z')],2);
 assert.equal(r.endpointReviewSourceOnlyCount,3);
 assert.deepEqual(r.endpointReviewSourceCandidates.map(x=>x.nodeId),['A','B']);
 assert.equal(r.endpointReviewCandidateLimit,2);
 assert.equal(r.endpointReviewSinkOnlyCount,3);
 assert.equal(r.endpointReviewSinkCandidates.length,2);
 assert.deepEqual(r.endpointReviewSinkCandidates.map(x=>x.nodeId),['X','Y']);
});
test('invalid coordinates are omitted, never treated as verified GPS locations',()=>{
 const r=audit([{from:'A',to:'B',a:[999,101],b:[3,NaN]}]);
 assert.equal(r.endpointReviewAvailable,true);
 assert.equal(r.endpointReviewSourceCandidates[0].point,null);
 assert.equal(r.endpointReviewSinkCandidates[0].point,null);
});
test('malformed or empty topology returns unknown, not a misleading zero',()=>{
 for(const cases of [null,[],[null],[edge('','B')],[edge('A',' ')],[{from:'A'}]]){
  const r=audit(cases);
  assert.equal(r.endpointReviewAvailable,false);
  assert.equal(r.endpointReviewSourceOnlyCount,null);
  assert.equal(r.endpointReviewSinkCandidates,null);
  assert.equal(r.legalDrivingRouteVerified,false);
 }
});
test('offline endpoint screening matches independent weak-topology count on a long corridor',()=>{
 const edges=Array.from({length:12000},(_,i)=>edge('N'+i,'N'+(i+1)));
 const r=audit(edges),t=topology(edges);
 assert.equal(r.endpointReviewSourceOnlyCount,t.topologySourceOnlyNodes);
 assert.equal(r.endpointReviewSinkOnlyCount,t.topologySinkOnlyNodes);
 assert.equal(r.endpointReviewSourceCandidates.length,1);
 assert.equal(r.endpointReviewSinkCandidates.length,1);
});
