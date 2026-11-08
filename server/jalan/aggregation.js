'use strict';
// Pure aggregation logic. No database access, no side effects.
const WINDOW_MS = 120000;
function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x,y)=>x-y), m=Math.floor(a.length/2);
  return a.length%2 ? a[m] : (a[m-1]+a[m])/2;
}
function aggregateObservations(docs, windowEnd, options={}) {
  const windowMs=options.windowMs||WINDOW_MS;
  const end=Math.floor(windowEnd/windowMs)*windowMs;
  const windows=[end/windowMs-2,end/windowMs-1];
  const grouped=new Map();
  for(const o of docs){
    const at=o.at instanceof Date?o.at.getTime():new Date(o.at).getTime();
    if(!Number.isFinite(at)||at<end-2*windowMs||at>=end||!Number.isFinite(o.speed)||o.speed<0||o.speed>180||!o.sessionHash||!Number.isInteger(o.direction)||o.direction<0||o.direction>7||typeof o.cell!=='string')continue;
    const win=Math.floor(at/windowMs),key=JSON.stringify([o.cell,o.direction]);
    if(!grouped.has(key))grouped.set(key,{cell:o.cell,direction:o.direction,windows:new Map()});
    const group=grouped.get(key);
    if(!group.windows.has(win))group.windows.set(win,new Map());
    const sessions=group.windows.get(win);
    if(!sessions.has(o.sessionHash))sessions.set(o.sessionHash,[]);
    sessions.get(o.sessionHash).push(o.speed);
  }
  const segments=[];
  for(const group of grouped.values()){
    const stats=windows.map(win=>{
      const sessions=group.windows.get(win)||new Map();
      return {contributors:sessions.size,medianSpeedKmh:median([...sessions.values()].map(median)),observations:[...sessions.values()].reduce((n,a)=>n+a.length,0)};
    });
    const [older,newer]=stats;
    if(newer.contributors<3)continue;
    const enough=older.contributors>=3&&newer.contributors>=3;
    const sustained=enough&&older.medianSpeedKmh<=20&&newer.medianSpeedKmh<=20;
    segments.push({cell:group.cell,direction:group.direction,contributors:newer.contributors,observations:newer.observations,meanSpeedKmh:Math.round(newer.medianSpeedKmh),medianSpeedKmh:Math.round(newer.medianSpeedKmh),speedStatistic:'median-of-session-medians',evidence:sustained?'sustained-low-speed':enough?'no-sustained-low-speed':'insufficient-history',confidence:enough?'multi-session-two-windows':'preliminary',windows:stats.map(w=>({contributors:w.contributors,medianSpeedKmh:w.medianSpeedKmh===null?null:Math.round(w.medianSpeedKmh)}))});
  }
  segments.sort((a,b)=>b.contributors-a.contributors);
  return segments.slice(0,30);
}
module.exports={aggregateObservations,median,WINDOW_MS};
