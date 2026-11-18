'use strict';
// WRRP v3 scores ONLY the information held consistently in the publication directory.
// It does not infer experimental results or originality beyond disclosed textual signals.
const VERSION='keyword-directory-v3.0';
const weights={relevance:25,technical:20,practical:20,evidence:15,originality:10,timeliness:10};
const groups={
 relevance:[
  ['upstream',/\b(?:upstream|reservoir|drill(?:ing)?|well(?:bore)?|exploration|oil production|petroleum production|crude oil production)\b/i],
  ['midstream',/\b(?:midstream|lng|liquefied natural gas|pipeline(?:s)?|gas transmission|gas transport|gas storage|fiscal metering)\b/i],
  ['downstream',/\b(?:refiner(?:y|ies)|refin(?:ing|ery)|petrochemical(?:s)?|gas processing|petroleum processing|distillation|combustion|sludge|crude)\b/i],
  ['measurement',/\b(?:measur(?:e|es|ement|ements|ing)|meter(?:s|ing)?|instrument(?:s|ation)?|calibrat(?:ion|e|ed)|analy[sz]ers?|sensors?|monitor(?:ing|s)?|flow)\b/i],
  ['sector and priorities',/\b(?:oil\s+(?:and|&)\s+gas|petroleum|hydrocarbon|natural gas|energy|safety|integrity|risk|corrosion|emissions?|methane|environment(?:al)?|sustainab\w*|renewable|digital|reliab\w*)\b/i]
 ],
 technical:[
  ['technical approach',/\b(?:method(?:ology)?|approach|algorithm|technique|framework|design|system|technology|develop(?:ment|ed)?)\b/i],
  ['analysis',/\b(?:analy[sz](?:e|ing|sis)|model(?:ling|ing)?|simulat(?:ion|e)|prediction|assess(?:ment)?|evaluation|statistical)\b/i],
  ['measurement and experimentation',/\b(?:experiment(?:al)?|test(?:ing)?|measur(?:ement|ements|ed)|sensors?|survey|observations?|data|samples?)\b/i],
  ['comparison or improvement',/\b(?:compar(?:ison|ative)|improv(?:e|ement)|optimi[sz](?:ation|e)|performance|result|reduction|enhanc(?:e|ement))\b/i]
 ],
 practical:[
  ['engineering setting',/\b(?:plant|refiner(?:y|ies)|platform|offshore|pipeline|field|facilit(?:y|ies)|industrial|operat(?:ion|ing)|upstream)\b/i],
  ['implementation',/\b(?:implementation|deploy(?:ment|ed)|application|case study|pilot|prototype|installation|processing)\b/i],
  ['operational benefit',/\b(?:reliability|efficien(?:cy|t)|cost|safety|risk|maintenance|emissions?|environmental|integrity|production|performance)\b/i],
  ['applicable subject',/\b(?:instruments?|meters?|sensors?|calibrat\w*|inspection|monitoring|optimisation|optimization|prediction|recycling|treatment|removal|filtration|flow)\b/i]
 ],
 originality:[
  ['explicit novelty',/\b(?:novel|innovativ(?:e|ion)|new|emerging|original|first[- ](?:reported|demonstration|application)|next.generation)\b/i],
  ['development or improvement',/\b(?:develop(?:ment|ed)|design|advanc(?:ed|ement)|improv(?:ed|ement)|propos(?:ed|al)|framework)\b/i]
 ],
 timeliness:[
  ['safety and reliability',/\b(?:safety|risk|reliability|integrity|hazard|corrosion|maintenance)\b/i],
  ['environment and transition',/\b(?:environment|climate|emissions?|methane|sustainab|renewable|transition|pollution|carbon)\b/i],
  ['productivity and digitalisation',/\b(?:efficien(?:cy|t)|cost|digital|automation|artificial intelligence|ai|optim(?:ization|isation)|performance|prediction)\b/i]
 ]
};
const tier={
 relevance:[0,18,22,25,25,25],
 technical:[0,7,12,16,20],
 practical:[0,6,11,16,20],
 originality:[0,5,10],
 timeliness:[0,5,8,10]
};
function normalize(x){return String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim();}
function directoryAssessment(p){
 const title=normalize(p.title),summary=normalize(p.summary),topic=normalize(p.topic);
 const text=[title,summary,topic].filter(Boolean).join(' ');
 const matches={},breakdown={},reasons={};
 for(const [key,signals] of Object.entries(groups)){
  const found=signals.map(([signal,re])=>{
   const match=text.match(re);
   return match?{signal,term:match[0]}:null;
  }).filter(Boolean);
  matches[key]=found;breakdown[key]=tier[key][Math.min(tier[key].length-1,found.length)];
  reasons[key]=found.length?found.map(x=>x.signal+': '+x.term).join('; '):
   'No explicit indicator in the directory title, summary or topic';
 }
 // Credibility is RECORD COMPLETENESS and source traceability, not
 // validation of scientific results. Never infer peer-review quality.
 const source=normalize(p.source),byline=normalize(p.byline);
 const metadata=[
  ['source link provided',/^https:\/\/[^/\s]+/i.test(source),6],
  ['specific research title',title.length>=15,3],
  ['named published authors',byline.length>=3,3],
  ['descriptive summary and topic',summary.length>=45&&topic.length>=2,3]
 ];
 const sourceSignals=metadata.filter(x=>x[1]).map(([signal,,points])=>({signal,term:signal,points}));
 matches.evidence=sourceSignals;
 breakdown.evidence=sourceSignals.reduce((n,x)=>n+x.points,0);
 reasons.evidence=sourceSignals.map(x=>x.signal+' (+'+x.points+')').join('; ')||'Publication metadata incomplete';
 const issues=[];
 if(!title||!summary||!topic||!byline)issues.push('missing-required-directory-field');
 if(!/^https:\/\/[^/\s]+/i.test(source))issues.push('published-source-link-missing');
 if(['retracted','withdrawn','disputed'].includes(String(p.integrityStatus||'').toLowerCase()))issues.push('integrity-hold');
 const total=Object.values(breakdown).reduce((a,b)=>a+b,0);
 return {mode:'rule-based-directory',version:VERSION,weights,total,breakdown,matches,reasons,
  evidence:{inputFields:['title','summary','topic','source','byline'],issues,
   sourceMetadataPresent:sourceSignals.length,source,summaryCharacters:summary.length},
  confidence:'limited-to-directory-metadata',eligibleForEditorialReview:issues.length===0,
  readyForRecognition:false,
  note:'Uniform editorial keyword indicators from existing title, summary and topic. Evidence points reflect metadata completeness only; not scientific validation or independent novelty.'};
}
// Keep historical abstract assessor for optional diagnostics and older tests.
// The weekly competition uses ONLY directoryAssessment.
const abstractAssessment=p=>directoryAssessment({...p,title:p.title||'',summary:p.abstract||'',topic:p.topic||''});
module.exports={VERSION,weights,groups,directoryAssessment,abstractAssessment,normalize};
