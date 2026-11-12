'use strict';
// Experimental edge-state Dijkstra on an already loaded directed graph.
// Applies ONLY independently verified, simple, unconditional via-node rules.
// No production integration; unverified/complex restrictions are a safety blocker.
const {classifyTurnEnforcement}=require('./kl-turn-enforcement-readiness-v4102');
// Edge IDs are authoritative in this prototype. A caller-supplied roadId
// must never override their OSM identity and silently bypass a turn rule.
function verifiedWayOf(edge){
 const m=/^(osm-way-\d+):\d+:[FR]$/.exec(edge?.id||'');
 if(!m)throw Error('Missing OSM way identity for turn-aware search');
 if(edge.roadId!==undefined&&edge.roadId!==m[1])
  throw Error('Conflicting OSM way identity for turn-aware search');
 return m[1];
}
// Binary min-heap avoids re-sorting the entire frontier on each expansion.
class MinQueue {
 constructor(){this.a=[];}
 get length(){return this.a.length;}
 push(x){
  const a=this.a;let i=a.length;a.push(x);
  while(i>0){const p=(i-1)>>1;if(a[p].cost<=x.cost)break;a[i]=a[p];i=p;}
  a[i]=x;
 }
 pop(){
  const a=this.a,first=a[0],last=a.pop();
  if(a.length){
   let i=0;
   while(2*i+1<a.length){
    let c=2*i+1;
    if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;
    if(a[c].cost>=last.cost)break;
    a[i]=a[c];i=c;
   }
   a[i]=last;
  }
  return first;
 }
}
function searchTurnAware(g,startNode,endNode,restrictions){
 if(!g||!(g.adj instanceof Map)||typeof startNode!=='string'||typeof endNode!=='string')
  throw new TypeError('Directed adjacency and node IDs required');
 if(!Array.isArray(restrictions)||restrictions.length===0)
  return {ok:false,reason:'no-verified-turn-restriction-coverage',
   turnRestrictionsEnforced:false,productionRoutingAuthorized:false};
 const readiness=classifyTurnEnforcement(restrictions);
 if(!readiness.allRestrictionsReady)return {ok:false,reason:'turn-restrictions-not-fully-verified',
  eligibleCount:readiness.eligible.length,counts:readiness.counts,productionRoutingAuthorized:false};
 if(startNode===endNode)return {ok:true,distanceMeters:0,pathEdgeIds:[],visited:0,
  turnRestrictionsEnforced:true,productionRoutingAuthorized:false};
 const rules=new Map();
 for(const r of readiness.eligible){
  const k=JSON.stringify([r.fromWay,r.viaNode]);
  if(!rules.has(k))rules.set(k,[]);
  rules.get(k).push(r);
 }
 const queue=new MinQueue();
 const initial={node:startNode,prev:null,cost:0,key:JSON.stringify([startNode,null])};
 queue.push(initial);
 const dist=new Map([[initial.key,0]]),previous=new Map();
 let visited=0;
 while(queue.length){
  const cur=queue.pop();
  if(cur.cost!==dist.get(cur.key))continue;
  if(++visited>400000)throw Error('Turn-aware search visit limit');
  if(cur.node===endNode){
   const path=[];let k=cur.key;
   while(previous.has(k)){const x=previous.get(k);path.push(x.edge.id);k=x.parent;}
   path.reverse();
   return {ok:true,distanceMeters:cur.cost,pathEdgeIds:path,visited,
    turnRestrictionsEnforced:true,productionRoutingAuthorized:false};
  }
  for(const e of g.adj.get(cur.node)||[]){
   // Validate the entire directed connection, including the first edge of a path.
   // A mismatched origin or missing identity cannot establish legal adjacency.
   if(!e||typeof e.id!=='string'||!e.id.trim()||
      typeof e.from!=='string'||e.from!==cur.node||
      typeof e.to!=='string'||!e.to||!Number.isFinite(e.len)||e.len<0)
    throw Error('Invalid graph edge');
   const fromWay=cur.prev?verifiedWayOf(cur.prev):null,toWay=verifiedWayOf(e);
   const applicable=fromWay?(rules.get(JSON.stringify([fromWay,cur.node]))||[]):[];
   let forbidden=false;
   for(const r of applicable){
    // A no_u_turn on the same OSM way must not block forward travel.
    // A true reversal returns to the incoming edge's origin node.
    const forwardContinuation=r.restriction==='no_u_turn'&&
     fromWay===toWay&&cur.prev.from!==e.to;
    // Do not treat arbitrary reverse-node movement on another way as a
    // verified U-turn exception. Only same-way forward continuation qualifies.
    if(r.restriction.startsWith('no_')&&toWay===r.toWay&&
       !forwardContinuation)forbidden=true;
    if(r.restriction.startsWith('only_')&&toWay!==r.toWay)forbidden=true;
   }
   if(forbidden)continue;
   const key=JSON.stringify([e.to,e.id]),nd=cur.cost+e.len;
   if(!Number.isFinite(nd))throw Error('Invalid accumulated turn-aware route cost');
   if(nd<(dist.get(key)??Infinity)){
    dist.set(key,nd);previous.set(key,{parent:cur.key,edge:e});
    queue.push({node:e.to,prev:e,cost:nd,key});
   }
  }
 }
 return {ok:false,reason:'no-turn-compliant-path',visited,
  turnRestrictionsEnforced:true,productionRoutingAuthorized:false};
}
module.exports={searchTurnAware};
