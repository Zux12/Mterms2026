'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('./community-reports'),P=require('./report-policy');
const copy=x=>structuredClone(x),actor=n=>'actor_'+String(n).padStart(24,'0'),road={key:'road-101',level:'0:surface'};
function setup(){let at=1000000,sequence=0;const docs=new Map(),repository={async get(key){return docs.has(key)?copy(docs.get(key)):null;},async cas(key,revision,value){if((docs.get(key)?.revision||0)!==revision)return false;docs.set(key,copy(value));return true;},async nearby(){return [...docs.values()].flatMap(d=>copy(d.events));}};const api=createService({repository,secret:'test-only-secret'.repeat(3),now:()=>at,id:()=>String(++sequence)});return {api,docs,advance:ms=>at+=ms,input:(n=1,extra={})=>({type:'accident',position:[101.687,3.139],heading:90,accuracy:8,fixAt:at,road,actor:actor(n),submissionId:actor(n),...extra}),response:(id,n,answer,extra={})=>({id,actor:actor(n),journey:'journey_12345678901234567890',answer,position:[101.687,3.139],heading:90,accuracy:8,fixAt:at,road,...extra})};}
test('concurrent same-event reports coalesce, count distinct installations and preserve original pin',async()=>{const s=setup();const rows=await Promise.all([s.api.submit(s.input(1)),s.api.submit(s.input(2,{position:[101.6873,3.139]})),s.api.submit(s.input(3))]);assert.equal(new Set(rows.map(x=>x.event.id)).size,1);const events=await s.api.nearby([101.687,3.139]);assert.equal(events.length,1);assert.equal(events[0].contributors,3);assert.deepEqual(events[0].position,[101.687,3.139]);assert.equal((await s.api.submit(s.input(1))).event.contributors,3);assert.equal(JSON.stringify(events).includes(actor(1)),false);assert.equal(JSON.stringify(events).includes('responses'),false);});
test('opposing direction, parallel road, different grade, other type and distant event stay separate',async()=>{const s=setup();for(const input of [s.input(),s.input(2,{heading:270}),s.input(3,{road:{key:'parallel-road',level:'0:surface'}}),s.input(4,{road:{...road,level:'1:bridge'}}),s.input(5,{type:'hazard'}),s.input(6,{position:[101.69,3.139]})])await s.api.submit(input);assert.equal((await s.api.nearby([101.687,3.139])).length,6);});
test('unmatched direction or road is accepted as unverified and never grouped',async()=>{const s=setup();await s.api.submit(s.input(1,{heading:null,road:null}));await s.api.submit(s.input(2,{heading:null,road:null}));assert.equal((await s.api.nearby([101.687,3.139])).length,2);});
test('category expiry and confirmations extend only an active event; old TTL records are excluded',async()=>{for(const [type,policy]of Object.entries(P.types)){const s=setup(),r=await s.api.submit(s.input(1,{type}));assert.equal(r.event.expiresAt-r.event.createdAt,policy.minutes*60000);s.advance(policy.minutes*60000-1000);const v=await s.api.respond(s.response(r.event.id,2,'still'));assert.equal(v.event.expiresAt-v.event.updatedAt,policy.minutes*60000);s.advance(policy.minutes*60000);assert.deepEqual(await s.api.nearby([101.687,3.139]),[]);await assert.rejects(s.api.respond(s.response(r.event.id,3,'still')),e=>e.status===410);}});
test('one cleared vote cannot remove an event, repeat vote cannot count twice, two installations can clear',async()=>{const s=setup(),r=await s.api.submit(s.input());assert.equal((await s.api.respond(s.response(r.event.id,2,'cleared'))).removed,false);assert.equal((await s.api.respond(s.response(r.event.id,2,'cleared'))).duplicate,true);assert.equal((await s.api.respond(s.response(r.event.id,2,'cleared',{journey:'journey_different_123456789'}))).removed,false);assert.equal((await s.api.respond(s.response(r.event.id,3,'cleared'))).removed,true);assert.deepEqual(await s.api.nearby([101.687,3.139]),[]);});
test('still-there confirmation resets cleared votes; remote and wrong-road votes rejected',async()=>{const s=setup(),r=await s.api.submit(s.input());await s.api.respond(s.response(r.event.id,2,'cleared'));await s.api.respond(s.response(r.event.id,3,'still'));assert.equal((await s.api.respond(s.response(r.event.id,4,'cleared'))).removed,false);for(const extra of [{heading:270},{position:[101.7,3.139]},{road:{key:'parallel',level:'0:surface'}},{road:{...road,level:'1:bridge'}}])await assert.rejects(s.api.respond(s.response(r.event.id,5,'still',extra)),e=>e.status===400);});
test('invalid, stale, inaccurate and future GPS cannot create reports',async()=>{const s=setup();for(const extra of [{position:[NaN,3]},{accuracy:90},{accuracy:-1},{fixAt:1},{fixAt:2000000},{heading:999},{type:'invented'},{type:'__proto__'},{type:'constructor'},{actor:'short'}])await assert.rejects(s.api.submit(s.input(1,extra)),e=>e.status===400);assert.equal(s.docs.size,0);});
test('directional route projection rejects opposite carriageway and off-route reports',()=>{const line=[[101.68,3.139],[101.70,3.139]],e={position:[101.69,3.139],heading:90};assert.ok(P.routeMatch(e,line));assert.equal(P.routeMatch({...e,heading:270},line),null);assert.equal(P.routeMatch({...e,position:[101.69,3.14]},line),null);assert.ok(P.project(e.position,line).along>1000);});

test('retry of an unmatched submission is idempotent without merging other users',async()=>{const s=setup(),input=s.input(1,{heading:null,road:null});const first=await s.api.submit(input),retry=await s.api.submit(input);assert.equal(first.event.id,retry.event.id);assert.equal((await s.api.nearby(input.position)).length,1);});

test('traffic levels survive grouping, nearby reads and confirmation, including older ungraded reports',async()=>{
 const s=setup(),report=(n,level)=>s.input(n,{type:'traffic',trafficSeverity:level});
 const old=await s.api.submit(report(1,undefined));
 assert.equal(old.event.trafficSeverity,undefined);
 s.advance(100);const light=await s.api.submit(report(2,'light'));
 assert.equal(light.event.id,old.event.id);assert.equal(light.event.trafficSeverity,'light');
 s.advance(100);const heavy=await s.api.submit(report(3,'heavy'));
 assert.equal(heavy.event.id,old.event.id);assert.equal(heavy.event.contributors,3);
 await s.api.submit(report(2,'light'));
 await s.api.submit(report(4,undefined));
 assert.equal((await s.api.nearby(old.event.position))[0].trafficSeverity,'heavy');
 assert.equal((await s.api.respond(s.response(old.event.id,5,'still'))).event.trafficSeverity,'heavy');
 await assert.rejects(s.api.submit(report(5,'severe')),e=>e.status===400);
 await assert.rejects(s.api.submit(s.input(6,{trafficSeverity:'light'})),e=>e.status===400);
});

test('traffic confirmations count installations once and auto-clear only after newer same-stretch passages',async()=>{
 const s=setup(),segment='s1234123412341234';
 const first=(await s.api.submit(s.input(1,{type:'traffic',segment}))).event;
 assert.equal(first.status,'reported');const key=first.id.split('.')[0];
 s.advance(5000);const self=await s.api.respond(s.response(first.id,1,'still'));
 assert.equal(self.event.expiresAt,first.expiresAt);
 const confirmed=(await s.api.respond(s.response(first.id,2,'still'))).event;
 assert.equal(confirmed.status,'confirmed');assert.equal(confirmed.contributors,2);
 s.advance(5000);assert.equal((await s.api.submit(s.input(2,{type:'traffic',segment}))).event.updatedAt,confirmed.updatedAt);
 await s.api.clearFromFlow(key,segment,first.updatedAt+1);await s.api.clearFromFlow(key,'sffffffffffffffff',confirmed.updatedAt+1);
 assert.equal((await s.api.nearby(first.position)).length,1);
 await s.api.clearFromFlow(key,segment,confirmed.updatedAt+1);assert.deepEqual(await s.api.nearby(first.position),[]);
});
const {createFlowService}=require('./community-reports-flow');
function traffic(){
 let at=1000000;const rows=new Map(),clears=[];
 const store={get:k=>structuredClone(rows.get(k)),async cas(k,rev,v){if((rows.get(k)?.revision||0)!==rev)return false;rows.set(k,structuredClone(v));return true;},read:regions=>[...rows.values()].filter(r=>regions.includes(r.region))};
 const service=createFlowService({store,now:()=>at,secret:'test',clear:(...args)=>clears.push(args)});
 const obs=(n,speed,options={})=>service.observe({segment:'saaaaaaaaaaaaaaaa',region:'r1016_31',speed,driver:n.toString(16).padStart(64,'0'),passAgeMs:null,normal:60,road:{key:'vector-abba',level:'0:surface'},...options});
 return {obs,clears,read:async()=>(await service.read({regions:['r1016_31']})).sections,advance:ms=>at+=ms};
}
test('shared speeds require three independent, sustained, same-road observations and expire',async()=>{
 const f=traffic();await f.obs(1,15);f.advance(60000);await f.obs(1,12);await f.obs(2,12);
 assert.deepEqual(await f.read(),[]);f.advance(60000);
 await f.obs(3,15,{segment:'sbbbbbbbbbbbbbbbb'});assert.deepEqual(await f.read(),[]);
 await f.obs(3,15);let rows=await f.read();assert.equal(rows.length,1);assert.equal(rows[0].type,'heavy');assert.equal(rows[0].speed,12);
 assert.deepEqual(Object.keys(rows[0]).sort(),['expiresAt','normal','segment','speed','type']);
 await f.obs(4,12,{road:{key:'vector-abba',level:'1:bridge'}});assert.deepEqual(await f.read(),[]);
 f.advance(300001);assert.deepEqual(await f.read(),[]);assert.equal(f.clears.length,0);
 await assert.rejects(f.obs(1,12,{position:[101,3]}),e=>e.status===400);
});
test('one slow driver among moving traffic is smooth only with three independent fast traversals',async()=>{
 const f=traffic();await f.obs(1,10);await f.obs(2,60,{passAgeMs:8000});await f.obs(3,55,{passAgeMs:5000});await f.obs(4,62);
 assert.equal(f.clears.length,0);assert.equal((await f.read())[0].type,'smooth');await f.obs(2,60,{passAgeMs:3000});assert.equal(f.clears.length,0);
 await f.obs(4,60,{passAgeMs:8000});const [r]=await f.read();assert.equal(r.type,'smooth');
 assert.equal(f.clears[0][2],982000);f.advance(300001);assert.deepEqual(await f.read(),[]);
});
