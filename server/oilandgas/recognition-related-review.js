'use strict';
// Read-only caution. Similar titles/authors are NOT proof of duplicate publication.
// Automatic DOI/source lifetime exclusion is handled by recognition-selector.js.
const SKIP=new Set(['the','of','for','a','an','and','in','on','through','using','to','with','study']);
function titleWords(value){
 return new Set(String(value||'').normalize('NFKC').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!SKIP.has(w)));
}
function overlap(a,b){
 const x=titleWords(a),y=titleWords(b);
 if(!x.size||!y.size)return 0;
 return [...x].filter(w=>y.has(w)).length/new Set([...x,...y]).size;
}
function authorSet(v){
 return new Set(String(v||'').split(/[,;]+/).map(x=>x.normalize('NFKC')
  .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean));
}
function authorOverlap(a,b){
 const x=authorSet(a),y=authorSet(b);
 if(!x.size||!y.size)return 0;
 return [...x].filter(w=>y.has(w)).length/Math.max(x.size,y.size);
}
function reviewPairs(papers,{minimumScore=60}={}){
 const eligible=papers.filter(p=>(p.assessment?.total??0)>=minimumScore),pairs=[];
 for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++){
  const a=eligible[i],b=eligible[j];
  const t=overlap(a.title,b.title),authors=authorOverlap(a.byline,b.byline);
  if(!((t>=0.75&&authors>=0.75)||(t>=0.55&&authors===1)))continue;
  pairs.push({referenceA:a.reference,referenceB:b.reference,
   titleA:a.title,titleB:b.title,scoreA:a.assessment.total,scoreB:b.assessment.total,
   titleOverlap:Number(t.toFixed(3)),authorOverlap:Number(authors.toFixed(3)),
   flag:'manual-related-publication-review',
   explanation:'Similar titles and author lists. Different publication sources may represent distinct work; do not infer plagiarism or duplicate research.'});
 }
 return pairs.sort((a,b)=>(b.titleOverlap+b.authorOverlap)-(a.titleOverlap+a.authorOverlap));
}
module.exports={titleWords,overlap,authorSet,authorOverlap,reviewPairs};
