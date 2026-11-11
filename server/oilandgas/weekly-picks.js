'use strict';

const positions=[['field','From the field','articles'],['research','Research into practice','publications']];
const kinds=['articles','publications'];
let cachedBrief,refreshAt=0,pending;

function excerpt(value){
  const text=String(value||'').trim();
  if(text.length<=300)return text;
  const cut=text.slice(0,300),space=cut.lastIndexOf(' ');
  return cut.slice(0,space>0?space:300)+'…';
}

async function loadBrief(){
  if(cachedBrief && Date.now()<refreshAt)return cachedBrief;
  if(!pending)pending=(async()=>{
    try{
      const response=await fetch('https://oilandgas.eu.com/editorial/weekly-brief.json',{
        signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)throw Error('Weekly brief unavailable');
      const brief=await response.json();
      if(!brief.field?.reference||!brief.research?.reference)throw Error('Incomplete weekly brief');
      cachedBrief=brief;refreshAt=Date.now()+60000;
    }catch(err){
      if(!cachedBrief)throw err;
      refreshAt=Date.now()+15000;
    }finally{pending=null;}
    return cachedBrief;
  })();
  return pending;
}

async function resolve(database,publicEntry,getBrief=loadBrief){
  const [saved,brief]=await Promise.all([
    database.collection('homepage').findOne({_id:'weekly-picks'}),getBrief()
  ]);
  const projection={reference:1,publication:1,source:1,name:1,publishedAt:1};
  return Promise.all(positions.map(async([slot,label,defaultKind])=>{
    const chosen=saved?.[slot];
    let record,kind=defaultKind,mode='weekly';
    if(chosen && kinds.includes(chosen.kind)){
      record=await database.collection(chosen.kind).findOne({reference:chosen.reference,
        status:'published',publication:{$exists:true},publicationId:chosen.publicationId??null},{projection});
      if(record){kind=chosen.kind;mode='manual';}
    }
    if(!record)record=await database.collection(kind).findOne({reference:brief[slot].reference,
      status:'published',publication:{$exists:true}},{projection});
    const isBriefChoice=mode==='weekly' && record?.reference===brief[slot].reference;
    if(!record)record=await database.collection(kind).findOne({status:'published',publication:{$exists:true}},
      {projection,sort:{publishedAt:-1,reference:-1}});
    const entry=record?publicEntry(record,kind):null;
    return {slot,label,mode,entry,
      headline:entry?(isBriefChoice&&brief[slot].headline||entry.title):'',
      teaser:entry?(isBriefChoice&&brief[slot].teaser||excerpt(entry.summary)):''};
  }));
}

module.exports={positions,resolve};
