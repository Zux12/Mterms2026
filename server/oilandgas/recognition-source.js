'use strict';
// DOI metadata and source abstract retrieval. Crossref is bibliographic evidence,
// not scientific peer review or proof that a publication is free of retractions.
const {validHttpsUrl}=require('./recognition-policy');
function doiFrom(source){try{const u=new URL(source);if(u.protocol!=='https:'||!['doi.org','dx.doi.org'].includes(u.hostname.toLowerCase()))return '';const doi=decodeURIComponent(u.pathname.slice(1));return /^10\.\d{4,9}\/\S+$/i.test(doi)?doi:''}catch{return ''}}
function titleMatch(a,b){const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const aa=norm(a),bb=norm(b);if(!aa||!bb)return false;if(aa===bb)return true;const x=new Set(aa.split(' ').filter(w=>w.length>=3)),y=new Set(bb.split(' ').filter(w=>w.length>=3));return [...x].filter(w=>y.has(w)).length/Math.max(x.size,y.size,1)>=0.78;}
const abstractRules=require('./recognition-rules');
function cleanMarkup(value){
 const str=String(value||'').slice(0,40000);
 return str.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi,m=>({
   '&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"
  }[m.toLowerCase()]||' '))
  .replace(/&#(\d+);/g,(m,x)=>{const n=Number(x);return n>=32&&n<=0x10ffff?String.fromCodePoint(n):' ';})
  .replace(/\s+/g,' ').trim().slice(0,16000);
}
async function crossrefAbstract(p,{fetcher=fetch}={}){
 if(!validHttpsUrl(p.source))return {status:'ineligible-source'};
 const doi=doiFrom(p.source);
 if(!doi)return {status:'doi-required',reason:'Requires a DOI resolver source; manual original-abstract verification available.'};
 try{
  const response=await fetcher('https://api.crossref.org/works/'+encodeURIComponent(doi),{
   headers:{Accept:'application/json','User-Agent':'Oilandgas-Research-Recognition/1.0 (https://oilandgas.eu.com)'},
   signal:AbortSignal.timeout(9000)
  });
  if(!response.ok)return {status:'crossref-unavailable',httpStatus:response.status};
  const data=await response.json(),w=data.message||{};
  const title=String(w.title?.[0]||'');
  if(!titleMatch(p.title,title))return {status:'title-mismatch',doi};
  const abstract=cleanMarkup(w.abstract);
  const screened=abstractRules.abstractAssessment({...p,abstract,abstractSourceVerified:true});
  if(!screened.eligibleForEditorialReview)
   return {status:'abstract-insufficient',doi,metadataTitle:title,
    length:abstract.length,words:screened.evidence.abstractWords};
  const authors=(Array.isArray(w.author)?w.author:[]).slice(0,150)
  .map(a=>[a.given,a.family].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
 return {status:'verified',doi,metadataTitle:title,abstract,verifiedAuthors:authors,
   source:'https://api.crossref.org/works/'+encodeURIComponent(doi),
   evidenceState:'crossref-title-and-abstract-match',retrievedAt:new Date()};
 }catch(e){return {status:'crossref-unavailable'};}
}
module.exports={cleanMarkup,crossrefAbstract};
