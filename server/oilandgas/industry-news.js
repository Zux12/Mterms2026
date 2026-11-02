const sax = require('./vendor/sax');
const feeds = [
  {name:'Rigzone', host:'rigzone.com', url:'https://www.rigzone.com/news/rss/rigzone_latest.aspx'},
  {name:'U.S. Energy Information Administration', host:'eia.gov', url:'https://www.eia.gov/rss/todayinenergy.xml'}
];
const day = 86400000;
const sector = /\b(petroleum|petrochemicals?|crude|natural gas|LNG|FLNG|FPSOs?|oilfields?|oil and gas|oil & gas|oil sands|OPEC\+?|refiner(?:y|ies)|gasoline|diesel|condensate|regasification|Brent|WTI)\b/i;
const context = /\b(oil|gas|drilling|upstream|downstream)\b/i;
const industry = /\b(pipelines?|wells?|barrels?|rigs?|production|producers?|exploration|exports?|imports?|prices?|reserves?|platforms?|terminals?|offshore|tanker[s]?)\b/i;
const irrelevant = /\b(olive oil|palm oil|cooking oil|vegetable oil|essential oils?|oil painting|greenhouse gas|laughing gas|tear gas|gas giant)\b/ig;
const lastGood = new Map();
let nextRefresh = 0, pending;

function relevant(text) {
  const clean = text.replace(irrelevant,' ');
  return sector.test(clean) || (context.test(clean) && industry.test(clean));
}
function parse(xml, feed) {
  const parser = sax.parser(true,{trim:false});
  const stories = [], stack = [];
  let item;
  parser.ondoctype = () => {throw Error('Unexpected DTD');};
  parser.onopentag = tag => {
    const key = tag.name.toLowerCase();
    stack.push(key);
    if (key==='item') item={};
  };
  parser.ontext = text => {
    const key=stack.at(-1);
    if(item && ['title','description','link','pubdate','dc:date'].includes(key))
      item[key]=(item[key] || '')+text;
  };
  parser.oncdata=parser.ontext;
  parser.onclosetag = () => {
    if(stack.pop()!=='item' || !item) return;
    const {title='',description='',link='',pubdate}=item;
    const time=Date.parse(pubdate || item['dc:date']);
    item=null;
    if(!title.trim() || !Number.isFinite(time)) return;
    const cleanTitle=title.replace(/<[^>]*>/g,'').trim();
    const intro=description.replace(/<[^>]*>/g,' ').slice(0,300);
    if(!relevant(cleanTitle) && !(industry.test(cleanTitle) && relevant(intro))) return;
    let url;
    try {url=new URL(link.trim());} catch {return;}
    if(!['http:','https:'].includes(url.protocol) || url.username || url.password ||
       !(url.hostname===feed.host || url.hostname.endsWith('.'+feed.host))) return;
    url.protocol='https:';url.hash='';
    for(const key of [...url.searchParams.keys()]) if(key.startsWith('utm_'))url.searchParams.delete(key);
    stories.push({title:cleanTitle,source:url.href,publishedAt:time,byline:feed.name,topic:'Industry news',kind:'external'});
  };
  parser.write(xml).close();
  return stories;
}
async function update(feed) {
  const response=await fetch(feed.url,{signal:AbortSignal.timeout(6000)});
  if(!response.ok) throw Error('Feed unavailable');
  const chunks=[];
  let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;
    if(size>2*1024*1024) throw Error('Feed too large');
    chunks.push(chunk);
  }
  lastGood.set(feed.url,parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,''),feed));
}
async function latest() {
  if(Date.now()>=nextRefresh && !pending){
    pending=Promise.allSettled(feeds.map(update)).then(results=>{
      const failed=results.some(r=>r.status==='rejected');
      nextRefresh=Date.now()+(failed ? 2 : 15)*60000;
    }).finally(()=>{pending=null;});
  }
  await pending;
  const now=Date.now();
  return [...lastGood.values()].flat().filter(s=>s.publishedAt<=now && now-s.publishedAt<=14*day)
    .sort((a,b)=>b.publishedAt-a.publishedAt || a.source.localeCompare(b.source));
}
module.exports={latest};
