'use strict';
// Pure, deterministic shortlist construction. No DB, network, email or activation.
const {normalizedName,thresholdFor}=require('./recognition-policy');
const categories=['editors-pick','industry-impact','emerging-research'];
const MS_DAY=86400000;
function names(byline){
 return String(byline||'').split(/[,;]+/).map(normalizedName).filter(Boolean);
}
function authorCooldown(candidate,history,now,days=84){
 const a=new Set(names(candidate.byline));
 return history.some(h=>{
  const dt=new Date(h.start).getTime();
  return Number.isFinite(dt)&&dt<=now&&dt>now-days*MS_DAY &&
   names(h.byline).some(n=>a.has(n));
 });
}
function paperCooldown(candidate,history,now,days=365){
 return history.some(h=>h.reference===candidate.reference &&
  h.kind===candidate.kind && Number.isFinite(new Date(h.start).getTime())&&
  new Date(h.start).getTime()>now-days*MS_DAY);
}
function categoryScore(p,category){
 const b=p.assessment?.breakdown||{};
 if(category==='industry-impact')return (b.practical||0)*1.25+(b.relevance||0)*0.8+(b.technical||0)*0.9+(b.evidence||0)+(b.timeliness||0);
 if(category==='emerging-research')return (b.originality||0)*1.5+(b.technical||0)+(b.relevance||0)*0.8+(b.evidence||0)+(b.timeliness||0);
 return p.assessment?.total||0;
}
function eligibleReview(p){
 const a=p.assessment||{};
 return a.mode==='ai-metadata-assessment'&&a.evidence?.bibliographyVerified===true&&
 a.evidence?.integrityCleared===true&&a.readyForRecognition===true&&
 p.reviewStatus==='approved'&&p.reviewRevisionMatches===true;
}
function choose(candidates,history=[],at=new Date(),options={}){
 const now=new Date(at).getTime();
 const verifiedOnly=options.verifiedOnly!==false;
 const remaining=candidates.filter(p=>!paperCooldown(p,history,now)&&
  (!verifiedOnly||eligibleReview(p)));
 const used=new Set(),selectedAuthors=new Set();
 const result=[];
 for(const category of categories){
  const threshold=thresholdFor(category);
  const pool=remaining.filter(p=>!used.has(p.kind+':'+p.reference)&&
   (p.assessment?.total||0)>=threshold);
  const ranked=pool.map(p=>{
   const repeats=names(p.byline).some(n=>selectedAuthors.has(n));
   const cooling=authorCooldown(p,history,now);
   return {p,repeats,cooling,score:categoryScore(p,category)};
  }).sort((x,y)=>{
   // First: avoid author repeats and 12-week repeat where viable; then technical merit.
   if(x.repeats!==y.repeats)return Number(x.repeats)-Number(y.repeats);
   if(x.cooling!==y.cooling)return Number(x.cooling)-Number(y.cooling);
   if(Math.abs(x.score-y.score)>5)return y.score-x.score;
   // A narrow, declared preference for verified Malaysian affiliation.
   if(Boolean(x.p.malaysianAffiliationVerified)!==Boolean(y.p.malaysianAffiliationVerified))
    return Number(Boolean(y.p.malaysianAffiliationVerified))-Number(Boolean(x.p.malaysianAffiliationVerified));
   return y.score-x.score||String(x.p.reference).localeCompare(String(y.p.reference));
  });
  const winner=ranked[0]?.p||null;
  if(winner){
   used.add(winner.kind+':'+winner.reference);
   names(winner.byline).forEach(n=>selectedAuthors.add(n));
  }
  result.push({category,candidate:winner,minimumScore:threshold,
   status:winner?'proposed':'no-qualified-reviewed-candidate'});
 }
 return result;
}
module.exports={choose,names,authorCooldown,paperCooldown,categoryScore,eligibleReview};
