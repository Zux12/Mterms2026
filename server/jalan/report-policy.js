/* Shared browser/server community-report policy. Coordinates are [longitude, latitude]. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.JalanReportModel=factory();})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const types=Object.freeze(Object.assign(Object.create(null),{traffic:{label:'Traffic',icon:'🚗',minutes:15},accident:{label:'Accident',icon:'💥',minutes:60},roadworks:{label:'Roadworks',icon:'🚧',minutes:240},closure:{label:'Road closed',icon:'⛔',minutes:120},hazard:{label:'Hazard',icon:'⚠️',minutes:30},police:{label:'Police',icon:'👮',minutes:30},rain:{label:'Heavy rain',icon:'🌧️',minutes:30},flood:{label:'Flooding',icon:'🌊',minutes:120},visibility:{label:'Poor visibility',icon:'🌫️',minutes:30}}));
 const trafficLevels=Object.freeze(['light','moderate','heavy']);
 function reportLabel(type,severity){
  if(type!=='traffic')return types[type]?.label||'Road event';
  if(!trafficLevels.includes(severity))return 'Traffic Jam · severity unknown';
  return severity[0].toUpperCase()+severity.slice(1)+' Traffic Jam';
 }
 const coord=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const heading=h=>typeof h==='number'&&Number.isFinite(h)&&h>=0&&h<360;
 const delta=(a,b)=>Math.abs(((a-b+540)%360)-180);
 const distance=(a,b)=>{const rad=Math.PI/180,x=(b[0]-a[0])*rad,y=(b[1]-a[1])*rad;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(y/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(x/2)**2)));};
 const bearing=(a,b)=>{const r=Math.PI/180,d=(b[0]-a[0])*r;return (Math.atan2(Math.sin(d)*Math.cos(b[1]*r),Math.cos(a[1]*r)*Math.sin(b[1]*r)-Math.sin(a[1]*r)*Math.cos(b[1]*r)*Math.cos(d))/r+360)%360;};
 function project(p,line){
  if(!coord(p)||!Array.isArray(line)||line.length<2||!line.every(coord))return null;
  let best=null,along=0;const sx=111320*Math.cos(p[1]*Math.PI/180),sy=111320;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],x=(b[0]-a[0])*sx,y=(b[1]-a[1])*sy,len=distance(a,b);if(len<.1)continue;
   const t=Math.max(0,Math.min(1,((p[0]-a[0])*sx*x+(p[1]-a[1])*sy*y)/(x*x+y*y))),q=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])],offset=distance(p,q);
   if(!best||offset<best.offset)best={point:q,offset,along:along+t*len,heading:bearing(a,b),index:i};along+=len;
  }return best?{...best,total:along}:null;
 }
 const road=r=>r&&typeof r.key==='string'&&/^[a-zA-Z0-9_.:-]{1,180}$/.test(r.key)&&typeof r.level==='string'&&r.level.length<=30;
 const sameRoad=(a,b)=>road(a)&&road(b)&&a.key===b.key&&a.level===b.level;
 const duplicate=(a,b)=>a.type===b.type&&sameRoad(a.road,b.road)&&heading(a.heading)&&heading(b.heading)&&delta(a.heading,b.heading)<=30&&distance(a.position,b.position)<=100;
 const alive=(event,now=Date.now())=>event&&event.active!==false&&Number.isFinite(event.expiresAt)&&event.expiresAt>now;
 function routeMatch(event,line){const p=project(event.position,line);return p&&p.offset<=25&&heading(event.heading)&&delta(p.heading,event.heading)<=40?p:null;}
 return {types,trafficLevels,reportLabel,coord,heading,delta,distance,bearing,project,road,sameRoad,duplicate,alive,routeMatch};
});
