'use strict';
// Read-only, iterative strongly-connected-component audit of a directed road graph.
// SCCs indicate graph reachability ONLY within imported node/edge semantics.
// They do not validate OSM access, turn rules, real road conditions or safe routes.
function unavailable(){
 return {
  strongConnectivityAvailable:false,strongComponentCount:null,
  strongLargestComponentNodes:null,strongLargestComponentShare:null,
  strongSingletonComponentCount:null,strongSourceComponentCount:null,
  strongSinkComponentCount:null,strongNodeCount:null,strongEdgeCount:null,
  strongInternalEdgeCount:null,strongCrossComponentEdgeCount:null,strongInternalEdgeShare:null,
  strongConnectivityAdvisoryOnly:true,roadLegalityVerified:false
 };
}
function auditStrongComponents(edges){
 if(!Array.isArray(edges)||edges.length===0)return unavailable();
 const ids=new Map(),arcs=[];
 function node(id){
  if(typeof id!=='string'||!id.trim())return -1;
  if(!ids.has(id))ids.set(id,ids.size);
  return ids.get(id);
 }
 for(const e of edges){
  if(!e||typeof e!=='object')return unavailable();
  const from=node(e.from),to=node(e.to);
  if(from<0||to<0)return unavailable();
  arcs.push([from,to]);
 }
 const n=ids.size;
 const forward=Array.from({length:n},()=>[]),reverse=Array.from({length:n},()=>[]);
 for(const [from,to] of arcs){forward[from].push(to);reverse[to].push(from);}
 // Iterative first pass: finishing order. A recursive DFS would overflow on
 // long one-way corridors, including synthetic graphs smaller than KL.
 const seen=new Uint8Array(n),finished=[];
 for(let start=0;start<n;start++){
  if(seen[start])continue;
  seen[start]=1;
  const stack=[{at:start,next:0}];
  while(stack.length){
   const top=stack[stack.length-1],neighbors=forward[top.at];
   if(top.next<neighbors.length){
    const to=neighbors[top.next++];
    if(!seen[to]){seen[to]=1;stack.push({at:to,next:0});}
   }else{finished.push(top.at);stack.pop();}
  }
 }
 // Reverse-edge DFS in decreasing finish order computes strong components.
 const group=new Int32Array(n);group.fill(-1);
 const sizes=[];
 for(let i=finished.length-1;i>=0;i--){
  const start=finished[i];if(group[start]!==-1)continue;
  const id=sizes.length,stack=[start];group[start]=id;let count=0;
  while(stack.length){
   const v=stack.pop();count++;
   for(const to of reverse[v])if(group[to]===-1){
    group[to]=id;stack.push(to);
   }
  }
  sizes.push(count);
 }
 const incoming=new Uint8Array(sizes.length),outgoing=new Uint8Array(sizes.length);
 let internalEdges=0,crossEdges=0;
 for(const [from,to] of arcs){
  const a=group[from],b=group[to];
  if(a!==b){outgoing[a]=1;incoming[b]=1;crossEdges++;}
  else internalEdges++;
 }
 let sources=0,sinks=0,largest=0,singletons=0;
 for(let i=0;i<sizes.length;i++){
  if(!incoming[i])sources++;
  if(!outgoing[i])sinks++;
  if(sizes[i]===1)singletons++;
  if(sizes[i]>largest)largest=sizes[i];
 }
 return {
  strongConnectivityAvailable:true,strongComponentCount:sizes.length,
  strongLargestComponentNodes:largest,strongLargestComponentShare:largest/n,
  strongSingletonComponentCount:singletons,strongSourceComponentCount:sources,
  strongSinkComponentCount:sinks,strongNodeCount:n,strongEdgeCount:edges.length,
  // Directed edges inside SCCs support mutual node reachability in this import.
  // Cross-SCC edges are traversable one way only at the component level.
  // Neither ratio proves access/turn legality, travel quality or safe navigation.
  strongInternalEdgeCount:internalEdges,strongCrossComponentEdgeCount:crossEdges,
  strongInternalEdgeShare:internalEdges/edges.length,
  strongConnectivityAdvisoryOnly:true,roadLegalityVerified:false
 };
}
module.exports={auditStrongComponents};
