'use strict';
// Experimental edge-state Dijkstra on an already loaded directed graph.
// Applies ONLY independently verified, simple, unconditional via-node rules.
// No production integration; unverified/complex restrictions are a safety blocker.
const {classifyTurnEnforcement}=require('./kl-turn-enforcement-readiness-v4102');
const {wayOf}=require('./kl-turn-audit-v4102');
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
 const queue=[{node:startNode,prev:null,cost:0,key:JSON.stringify([startNode,null])}];
 const dist=new Map([[queue[0].key,0]]),previous=new Map();
 let visited=0;
 while(queue.length){
  queue.sort((a,b)=>a.cost-b.cost);
  const cur=queue.shift();
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
   // This isolated prototype must not mistake malformed adjacency for a legal turn.
   // A missing initial-leg way ID is unsafe too: later turn-state keys depend on it.
   if(!e||typeof e.id!=='string'||!e.id.trim()||
      typeof e.from!=='string'||e.from!==cur.node||
      typeof e.to!=='string'||!e.to||!Number.isFinite(e.len)||e.len<0)
    throw Error('Invalid graph edge');
   const fromWay=cur.prev?wayOf(cur.prev):null,toWay=wayOf(e);
   if(!toWay||(cur.prev&&!fromWay))throw Error('Missing OSM way identity for turn-aware search');
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
   // Infinity must be a hard data/scale error, not a misleading no-path result.
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
