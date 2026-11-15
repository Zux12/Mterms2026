'use strict';
// Advisory-only comparison of DBKL July 2026 temporary control notice against
// existing imported KL OSM road names/nodes and directed-edge coverage.
// The notice is authority evidence; imported graph is NOT current signage.
// This script performs read-only operations and never records route/GPS data.
const mongoose = require('mongoose');
const NAMES = ['Jalan U Thant','Jalan Langgak Golf','Jalan Tun Razak'];
const NOTICE = {
  authority:'DBKL',
  published:'2026-07-05',from:'2026-07-06',through:'2027-01-31',
  url:'https://www.dbkl.gov.my/berita-acara/penutupan-sementara-laluan-jalan-di-jalan-u-thant-bagi-kerja-kerja-pembinaan-pipe-jacking'
};
function normalName(x){return String(x||'').trim().replace(/\s+/g,' ').toLowerCase();}
function summarise(roads,edgeIds,asOf){
  if(!Array.isArray(roads)||!Array.isArray(edgeIds)||!/^\d{4}-\d{2}-\d{2}$/.test(asOf))
    throw Error('Invalid audit inputs');
  const roadGroups = new Map(NAMES.map(name=>[name,{name,ways:[],wayIds:new Set(),nodes:new Set(),
    importedOnewayTrue:0,importedOnewayFalse:0,importedOnewayOther:0,directedEdges:0}]));
  const lookup=new Map(NAMES.map(name=>[normalName(name),name]));
  for(const road of roads){
    const exact=lookup.get(normalName(road?.name));
    if(!exact)continue;
    const match=String(road?.roadId||'').match(/^osm-way-([0-9]+)$/);
    if(!match)continue; // failed provenance; do not infer connectivity
    const g=roadGroups.get(exact);
    if(g.wayIds.has(match[1]))continue;
    g.wayIds.add(match[1]);
    const value=road.oneway===true?'importedOnewayTrue':
      road.oneway===false?'importedOnewayFalse':'importedOnewayOther';
    g[value]++;
    for(const n of Array.isArray(road.nodeIds)?road.nodeIds:[]){
      if(/^[0-9]+$/.test(String(n)))g.nodes.add(String(n));
    }
  }
  const ids=new Map();
  for(const g of roadGroups.values())for(const id of g.wayIds)ids.set(id,g);
  for(const id of edgeIds){
    if(typeof id!=='string')continue;
    const m=id.match(/^osm-way-([0-9]+):[0-9]+:[FR]$/);
    if(m&&ids.has(m[1]))ids.get(m[1]).directedEdges++;
  }
  function shared(a,b){
    const x=roadGroups.get(a).nodes,y=roadGroups.get(b).nodes;
    let n=0;for(const node of x)if(y.has(node))n++;
    return n; // possible graph junction only; not a legal turn
  }
  const grouped=NAMES.map(name=>{
    const g=roadGroups.get(name);
    return {name,importedWays:g.wayIds.size,importedDirectedEdges:g.directedEdges,
      onewayTrue:g.importedOnewayTrue,onewayFalse:g.importedOnewayFalse,
      onewayUnspecified:g.importedOnewayOther,
      importedPublicNodes:g.nodes.size};
  });
  return {
    mode:'DBKL_TEMPORARY_VS_IMPORTED_GRAPH_READ_ONLY',asOf,
    notice:NOTICE,withinPublishedControlWindow:asOf>=NOTICE.from&&asOf<=NOTICE.through,
    namedRoads:grouped,
    importedSharedNodeCandidates:{
      uThantTunRazak:shared(NAMES[0],NAMES[2]),
      langgakGolfTunRazak:shared(NAMES[1],NAMES[2])
    },
    namedRoadsWithoutExactImportedMatch:grouped.filter(x=>!x.importedWays).map(x=>x.name),
    interpretation:'Public OSM junction/oneway metadata only; DBKL describes specific temporary closed movements, not all junctions.',
    surveyedJunctionMatched:false,currentSignsVerified:false,
    independentCurrentOsmExtractVerified:false,actualTomTomComparisonVerified:false,
    temporaryControlEnforcementAuthorized:false,turnRestrictionsEnforced:false,
    legalDrivingRouteVerified:false,acceptedIndependentJourneys:0,
    databaseWrites:0
  };
}
async function audit(){
  const uri=process.env.JALAN_READONLY_MONGODB_URI;
  if(!uri)throw Error('Read-only Atlas connection unavailable');
  let parsed;
  try{parsed=new URL(uri);}catch{}
  if(!parsed||!['mongodb:','mongodb+srv:'].includes(parsed.protocol)||
    decodeURIComponent(parsed.username)!=='jalan_readonly')
    throw Error('Expected dedicated read-only Atlas credential');
  const asOf=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
  try{
    await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,readPreference:'secondaryPreferred'});
    const db=mongoose.connection.useDb('jalan_navigation',{useCache:true}).db;
    const roads=await db.collection('road_network_v493').find(
      {name:{$regex:'^Jalan (U Thant|Langgak Golf|Tun Razak)$',$options:'i'}},
      {projection:{_id:0,roadId:1,name:1,oneway:1,nodeIds:1},maxTimeMS:25000}
    ).limit(300).toArray();
    if(roads.length===300)throw Error('Named-road audit candidate cap reached');
    const edges=db.collection('road_graph_edges_v495');
    const edgeCount=await edges.countDocuments();
    if(edgeCount!==168221)throw Error('Imported KL graph edge count changed');
    const matched=[];
    const ids=new Set(roads.map(x=>String(x.roadId||'').replace(/^osm-way-/,'')).filter(x=>/^\d+$/.test(x)));
    // One bounded 168,221-edge index/identity scan, no user data or coordinates.
    for await(const e of edges.find({},{projection:{_id:0,edgeId:1},maxTimeMS:60000}).batchSize(2500)){
      const m=String(e.edgeId||'').match(/^osm-way-([0-9]+):[0-9]+:[FR]$/);
      if(m&&ids.has(m[1]))matched.push(e.edgeId);
    }
    const result=summarise(roads,matched,asOf);
    console.log(JSON.stringify({...result,fullImportedDirectedEdges:edgeCount}));
    // Never label an imported one-way flag as a legal road sign or certify a route.
  }finally{await mongoose.disconnect();}
}
if(require.main===module)audit().catch(()=>{
  console.error('DBKL road-name/read-only graph audit unavailable; private details suppressed.');
  process.exitCode=1;
});
module.exports={summarise,NOTICE,NAMES};
