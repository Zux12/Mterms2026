'use strict';
// Offline KL imported-road endpoint review. Read-only input; no router changes.
// Source-only/sink-only OSM nodes are review CANDIDATES, not proven defects.
function unavailable(){
 return {endpointReviewAvailable:false,endpointReviewSourceOnlyCount:null,
  endpointReviewSinkOnlyCount:null,endpointReviewSourceCandidates:null,
  endpointReviewSinkCandidates:null,endpointReviewAdvisoryOnly:true,
  legalDrivingRouteVerified:false};
}
const validNode=s=>typeof s==='string'&&s.trim().length>0;
const validPoint=p=>Array.isArray(p)&&p.length===2&&
 Number.isFinite(p[0])&&Number.isFinite(p[1])&&
 Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
function auditEndpointCandidates(edges,limit=8){
 if(!Array.isArray(edges)||!edges.length)return unavailable();
 const n=Number.isInteger(limit)&&limit>=1&&limit<=50?limit:8;
 const nodes=new Map();
 function node(id){let state=nodes.get(id);
  if(!state){state={nodeId:id,incoming:0,outgoing:0,point:null};nodes.set(id,state);}
  return state;}
 for(const e of edges){
  if(!e||!validNode(e.from)||!validNode(e.to))return unavailable();
  const a=node(e.from),b=node(e.to);
  a.outgoing++;b.incoming++;
  // Public imported-road coordinates only (not device/user GPS).
  if(a.point===null&&validPoint(e.a))a.point=[...e.a];
  if(b.point===null&&validPoint(e.b))b.point=[...e.b];
 }
 const source=[],sink=[];
 for(const state of nodes.values()){
  if(state.incoming===0&&state.outgoing>0)source.push(state);
  if(state.outgoing===0&&state.incoming>0)sink.push(state);
 }
 // Deterministic priority: higher directed degree, then numeric OSM ID string.
 // More edges at an endpoint deserves review, but is NOT proof of a bad import.
 source.sort((a,b)=>b.outgoing-a.outgoing||a.nodeId.localeCompare(b.nodeId,'en'));
 sink.sort((a,b)=>b.incoming-a.incoming||a.nodeId.localeCompare(b.nodeId,'en'));
 return {endpointReviewAvailable:true,
  endpointReviewSourceOnlyCount:source.length,
  endpointReviewSinkOnlyCount:sink.length,
  endpointReviewSourceCandidates:source.slice(0,n).map(({nodeId,outgoing,point})=>({nodeId,outgoing,point})),
  endpointReviewSinkCandidates:sink.slice(0,n).map(({nodeId,incoming,point})=>({nodeId,incoming,point})),
  endpointReviewCandidateLimit:n,
  endpointReviewAdvisoryOnly:true,legalDrivingRouteVerified:false};
}
module.exports={auditEndpointCandidates};
