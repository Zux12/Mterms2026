'use strict';
// Simulation-only road geometry matching. Coordinates are [latitude, longitude].
const RAD=Math.PI/180, EARTH=6371000;
function xy(p, origin){return [(p[1]-origin[1])*RAD*EARTH*Math.cos(origin[0]*RAD),(p[0]-origin[0])*RAD*EARTH];}
function bearing(a,b){const d=(b[1]-a[1])*RAD, y=Math.sin(d)*Math.cos(b[0]*RAD), x=Math.cos(a[0]*RAD)*Math.sin(b[0]*RAD)-Math.sin(a[0]*RAD)*Math.cos(b[0]*RAD)*Math.cos(d);return (Math.atan2(y,x)/RAD+360)%360;}
function delta(a,b){return Math.abs(((a-b+540)%360)-180);}
function candidate(point, road){
 let best=null;
 for(let i=1;i<road.geometry.length;i++){
  const a=xy(road.geometry[i-1],point),b=xy(road.geometry[i],point),dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy||1)));
  const dist=Math.hypot(a[0]+t*dx,a[1]+t*dy),head=bearing(road.geometry[i-1],road.geometry[i]);
  if(!best||dist<best.distance)best={roadId:road.id,distance:dist,heading:head,oneway:!!road.oneway};
 }
 return best;
}
function matchRoad(fix,roads,opts={}){
 const {position,heading,accuracy}=fix;
 if(!Array.isArray(position)||position.length!==2||!position.every(Number.isFinite)||!Number.isFinite(heading)||!Number.isFinite(accuracy)||accuracy<0||accuracy>25)return {status:'rejected',reason:'invalid-or-inaccurate-gps'};
 if(!Array.isArray(roads)||!roads.length)return {status:'rejected',reason:'no-road-data'};
 const maxDistance=opts.maxDistance??25, maxHeadingError=opts.maxHeadingError??35, ambiguityMargin=opts.ambiguityMargin??12;
 const matches=[];
 for(const road of roads){if(!road||!road.id||!Array.isArray(road.geometry)||road.geometry.length<2)continue;
  const c=candidate(position,road);if(!c||c.distance>maxDistance)continue;
  const forward=delta(heading,c.heading),reverse=delta(heading,(c.heading+180)%360);
  const direction=c.oneway?'forward':forward<=reverse?'forward':'reverse';
  const headingError=c.oneway?forward:Math.min(forward,reverse);
  if(headingError>maxHeadingError)continue;
  const score=c.distance+headingError*0.35;
  matches.push({...c,direction,headingError,score});
 }
 matches.sort((a,b)=>a.score-b.score);
 if(!matches.length)return {status:'rejected',reason:'no-compatible-road'};
 if(matches.length>1&&matches[1].score-matches[0].score<ambiguityMargin)return {status:'uncertain',reason:'ambiguous-parallel-roads',candidates:matches.slice(0,2).map(m=>m.roadId)};
 const m=matches[0];return {status:'matched',roadId:m.roadId,direction:m.direction,distanceMeters:Math.round(m.distance),headingErrorDegrees:Math.round(m.headingError)};
}
module.exports={matchRoad,bearing,delta};
