'use strict';
// Synthetic 168,221-edge scale smoke test. No database, secrets, or live traffic access.
// This is NOT a substitute for route quality and latency tests on actual KL road data.
const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {calculate,nearest,distance}=require('./kl-segment-v4102');

test('directed chain near pilot graph size can route beyond the old 150k-visit cap',()=>{
  const N=168221,lat=3.14,lng=101.6,step=0.000001;
  const startBuild=performance.now();
  const edges=new Array(N),adj=new Map();
  for(let i=0;i<N;i++){
    const a=[lat,lng+i*step],b=[lat,lng+(i+1)*step];
    const e={id:'e'+i,from:'n'+i,to:'n'+(i+1),a,b,len:distance(a,b)};
    edges[i]=e;
    adj.set(e.from,[e]);
  }
  const buildMs=performance.now()-startBuild;
  const nowSnap=performance.now();
  const mid=[lat,lng+Math.floor(N/2)*step];
  const snapped=nearest(edges,mid);
  const nearestMs=performance.now()-nowSnap;
  assert.ok(snapped);
  assert.ok(snapped.meters<0.01);
  const makeSnap=(e,t)=>({edge:e,t,point:[lat,e.a[1]+(e.b[1]-e.a[1])*t]});
  const nowRoute=performance.now();
  const route=calculate({adj,edges},makeSnap(edges[0],.2),makeSnap(edges[N-1],.8));
  const routeMs=performance.now()-nowRoute;
  assert.ok(route);
  assert.equal(route.edgeCount,N);
  assert.ok(route.visited>150000,'search must visit more than the previous hard cap');
  assert.equal(route.geometry.length,N+1);
  assert.ok(route.distanceMeters>10000);
  console.log('SYNTHETIC SCALE SMOKE (not actual KL network): '+JSON.stringify({
    edges:N,buildMs:Math.round(buildMs),nearestMs:Math.round(nearestMs),
    routeMs:Math.round(routeMs),visited:route.visited,
    heapUsedMB:Math.round(process.memoryUsage().heapUsed/1048576)
  }));
});
