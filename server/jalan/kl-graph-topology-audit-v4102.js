'use strict';
// Read-only, in-memory directed-road graph topology QA. Weak connectivity is
// NOT directed reachability, turn legality, access permission or navigation QA.
function unavailable(){return {
 graphTopologyAvailable:false,topologyNodeCount:null,topologyEdgeCount:null,
 topologySourceOnlyNodes:null,topologySinkOnlyNodes:null,
 topologyWeakComponentCount:null,topologySmallWeakComponentCount:null,
 topologyLargestWeakComponentNodes:null,topologyLargestWeakComponentEdges:null,
 topologyLargestWeakComponentShare:null,
 topologyAdvisoryOnly:true,directedReachabilityVerified:false
};}
function auditDirectedGraphTopology(edges){
 if(!Array.isArray(edges)||edges.length===0)return unavailable();
 const index=new Map(),parent=[],size=[],indegree=[],outdegree=[];
 function node(v){
  if(typeof v!=='string'||!v.trim())return -1;
  let i=index.get(v);
  if(i===undefined){i=parent.length;index.set(v,i);parent.push(i);size.push(1);indegree.push(0);outdegree.push(0);}
  return i;
 }
 function root(i){
  while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}
  return i;
 }
 function unite(a,b){
  a=root(a);b=root(b);if(a===b)return;
  if(size[a]<size[b]){const t=a;a=b;b=t;}
  parent[b]=a;size[a]+=size[b];
 }
 for(const e of edges){
  if(!e||typeof e!=='object')return unavailable();
  const a=node(e.from),b=node(e.to);
  if(a<0||b<0)return unavailable();
  outdegree[a]++;indegree[b]++;unite(a,b);
 }
 const comps=new Map();
 let sourceOnly=0,sinkOnly=0;
 for(let i=0;i<parent.length;i++){
  if(!indegree[i]&&outdegree[i])sourceOnly++;
  if(!outdegree[i]&&indegree[i])sinkOnly++;
  const r=root(i);comps.set(r,(comps.get(r)||0)+1);
 }
 let largestRoot=null,largestNodes=0,small=0;
 for(const [r,n] of comps){
  if(n>largestNodes){largestRoot=r;largestNodes=n;}
  if(n<5)small++;
 }
 let largestEdges=0;
 for(const e of edges)if(root(index.get(e.from))===largestRoot)largestEdges++;
 return {
  graphTopologyAvailable:true,topologyNodeCount:parent.length,topologyEdgeCount:edges.length,
  topologySourceOnlyNodes:sourceOnly,topologySinkOnlyNodes:sinkOnly,
  topologyWeakComponentCount:comps.size,topologySmallWeakComponentCount:small,
  topologyLargestWeakComponentNodes:largestNodes,topologyLargestWeakComponentEdges:largestEdges,
  topologyLargestWeakComponentShare:largestNodes/parent.length,
  topologyAdvisoryOnly:true,directedReachabilityVerified:false
 };
}
module.exports={auditDirectedGraphTopology};
