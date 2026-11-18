'use strict';
const {validHttpsUrl}=require('./recognition-policy');
function doiFrom(source){try{
 const u=new URL(String(source||''));if(u.protocol!=='https:'||
 !['doi.org','dx.doi.org'].includes(u.hostname.toLowerCase()))return '';
 const doi=decodeURIComponent(u.pathname.slice(1));
 return /^10\.\d{4,9}\/\S+$/i.test(doi)?doi:'';
}catch{return ''}}
function credibleRetraction(w){
 const updates=Array.isArray(w?.update)?w.update:[];
 for(const item of updates){
  const type=String(item?.type||'').toLowerCase(),label=String(item?.label||'').toLowerCase();
  if(type==='retraction'||label==='retraction')
   return {type:'retraction',description:'Crossref explicit retraction update'};
 }
 const related=w?.relation?.['is-retracted-by'];
 if(Array.isArray(related)&&related.length)
  return {type:'retraction',description:'Crossref is-retracted-by relationship'};
 return null;
}
async function inspect(p,{fetcher=fetch}={}){
 const doi=doiFrom(p.source);
 if(!doi||!validHttpsUrl(p.source))return {state:'unsupported'};
 try{
  const url='https://api.crossref.org/works/'+encodeURIComponent(doi);
  const response=await fetcher(url,{headers:{Accept:'application/json',
   'User-Agent':'Oilandgas-Research-Recognition/1.0 (https://oilandgas.eu.com)'},
   signal:AbortSignal.timeout(10000)});
  if(!response.ok)return {state:'unavailable'};
  const obj=await response.json(),w=obj.message||{};
  const notice=credibleRetraction(w);
  return notice?{state:'explicit-retraction',notice,evidenceUrl:url,doi}:
   {state:'no-explicit-notice-found',doi,evidenceUrl:url,
    disclaimer:'Absence of a Crossref notice is not scientific integrity clearance.'};
 }catch{return {state:'unavailable'}}
}
module.exports={doiFrom,credibleRetraction,inspect};
