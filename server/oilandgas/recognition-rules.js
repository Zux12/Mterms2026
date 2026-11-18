'use strict';
// WRRP deterministic v2. No AI, model calls or external side effects.
// Scores only supplied source-backed ABSTRACTS, never directory teasers.
const VERSION='keyword-abstract-v2.0';
const categories={
 relevance:{max:25,groups:[
  ['upstream',/\b(?:upstream|reservoir|drilling|wellbore|petroleum|hydrocarbon|production|wellhead)\b/i],
  ['midstream',/\b(?:pipeline|lng|liquefied natural gas|transportation|gas processing|gas transmission)\b/i],
  ['downstream',/\b(?:refin(?:e|ery|ing)|petrochemical|crack(?:er|ing)|distillation|crude oil)\b/i],
  ['measurement',/\b(?:measurement|metering|instrumentation|calibration|sensor|analy[sz]er|monitoring)\b/i],
  ['energy',/\b(?:oil and gas|natural gas|methane|emissions?|carbon|process safety|industrial energy)\b/i]]},
 technical:{max:20,groups:[
  ['method',/\b(?:methodolog(?:y|ies)|method|experiment(?:al)?|framework|algorithm|protocol)\b/i],
  ['analysis',/\b(?:analysis|analys(?:is|ed)|model(?:ling|ing)?|simulation|estimat(?:e|ion)|inversion)\b/i],
  ['evaluation',/\b(?:evaluat(?:ion|ed)|compar(?:ison|ed)|assess(?:ment|ed)|benchmark)\b/i],
  ['results',/\b(?:results?|findings?|observ(?:ed|ations)|measur(?:ed|ement)|demonstrat(?:ed|ion))\b/i]]},
 practical:{max:20,groups:[
  ['industrial setting',/\b(?:field trials?|pilot plant|operat(?:ing|ional)|refinery|production facility|industrial site|offshore platform)\b/i],
  ['application',/\b(?:applicab(?:le|ility)|application|deployment|implement(?:ation|ed)|practical|on-site|in situ)\b/i],
  ['benefit',/\b(?:reduc(?:e|tion)|improv(?:e|ement)|optimis(?:e|ation)|optimiz(?:e|ation)|efficien(?:t|cy)|reliab(?:le|ility))\b/i],
  ['real measurements',/\b(?:field data|plant data|actual measurements|satellite observations|instrument readings|operational data)\b/i]]},
 evidence:{max:15,groups:[
  ['reported quantified result',/\b(?:\d+(?:\.\d+)?\s*(?:%|percent|ppm|ppb|t(?:g|onnes?)|kg|bar|mwh|mw|hours?|days?|years?|fold|times)|±\s*\d)/i],
  ['comparative evidence',/\b(?:compared with|versus|higher than|lower than|baseline|control group|relative to|comparison)\b/i],
  ['uncertainty or validation',/\b(?:confidence interval|uncertaint(?:y|ies)|validated?|verification|standard deviation|error bounds?|±)\b/i]]},
 originality:{max:10,groups:[
  ['new proposed technique',/\b(?:we propose|this study proposes|we develop|developed a new|novel approach|new method|original approach)\b/i],
  ['explicit improvement',/\b(?:extends previous|previous work|improves on|new framework|first demonstration|first reported)\b/i]]},
 timeliness:{max:10,groups:[
  ['emissions and environment',/\b(?:emissions?|methane|carbon|pollution|climate|sustainab(?:le|ility)|energy transition)\b/i],
  ['safety and resilience',/\b(?:safety|integrity|reliability|corrosion|risk|hazard|security|resilien(?:t|ce))\b/i],
  ['industry cost and productivity',/\b(?:cost|performance|efficien(?:t|cy)|energy consumption|maintenan(?:ce|ces)|optimis(?:e|ation)|optimiz(?:e|ation))\b/i]]}
};
const weights={relevance:25,technical:20,practical:20,evidence:15,originality:10,timeliness:10};
function normalize(s){return String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim()}
function abstractAssessment(p){
 const abstract=normalize(p.abstract),words=abstract.split(/\s+/).filter(Boolean).length;
 const issues=[];
 // These minima prevent a directory snippet from being treated as the original abstract.
 if(words<75||abstract.length<450)issues.push('source-backed-abstract-insufficient');
 if(!p.abstractSourceVerified)issues.push('abstract-source-not-confirmed');
 if(!/^https:\/\/[^/\s]+/i.test(p.source||''))issues.push('original-source-required');
 if(p.integrityStatus&&['retracted','withdrawn','disputed'].includes(String(p.integrityStatus).toLowerCase()))
  issues.push('research-integrity-hold');
 const breakdown={},matches={},reasons={};
 // Always compute diagnostic scores, but never mark incomplete evidence as eligible.
 const text=abstract;
 for(const [key,config] of Object.entries(categories)){
  const found=config.groups.map(([signal,pattern])=>{
   const match=text.match(pattern);
   return match?{signal,term:match[0]}:null;
  }).filter(Boolean);
  matches[key]=found;
  // Granular points based on independent groups, not on repeated keyword frequency.
  // First topical match earns most industry relevance points: expertise in a
  // single field is not weaker than a paper spanning multiple business segments.
  // Additional independent evidence groups earn graduated, bounded points.
  const scoreSteps={
   relevance:[0,18,22,25,25,25],
   technical:[0,8,14,18,20],
   practical:[0,8,13,17,20],
   evidence:[0,6,11,15],
   originality:[0,5,10],
   timeliness:[0,5,8,10]
  };
  breakdown[key]=scoreSteps[key][Math.min(found.length,scoreSteps[key].length-1)];
  reasons[key]=found.length?found.map(x=>x.signal+': '+x.term).join('; '):'No explicit supporting phrase detected';
 }
 // Textual signals do not independently verify originality or source integrity.
 // Score is descriptive only; source & integrity must pass separate checks.
 const total=Object.values(breakdown).reduce((a,b)=>a+b,0);
 const eligibleForEditorialReview=issues.length===0;
 return {mode:'rule-based-abstract',version:VERSION,weights,total,breakdown,matches,reasons,
  evidence:{abstractSourceVerified:p.abstractSourceVerified===true,abstractWords:words,
   source:p.source||'',issues},confidence:issues.length?'insufficient':'screening-only',
  readyForRecognition:false,eligibleForEditorialReview,
  note:'Deterministic textual indicators only. Originality, scientific validity and retraction clearance require independent source checks.'};
}
module.exports={VERSION,categories,weights,abstractAssessment,normalize};
