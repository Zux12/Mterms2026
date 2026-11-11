'use strict';
// Run with node --test scripts/test-oilandgas-highlights.js. No live database is used.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const slots=require('../server/oilandgas/highlight-slots');

test('returning one position to automatic news leaves other selections intact',async()=>{
  const saved={_id:'highlights',lead:{reference:'LEAD'},story1:{reference:'ONE'},story2:{reference:'TWO'}};
  const collection={async updateOne(filter,update){
    assert.deepEqual(filter,{_id:'highlights'});
    assert.deepEqual(update,{$unset:{story1:''}});
    for(const key of Object.keys(update.$unset))delete saved[key];
  }};
  await slots.automatic(collection,'story1');
  assert.deepEqual(saved,{_id:'highlights',lead:{reference:'LEAD'},story2:{reference:'TWO'}});
  await assert.rejects(slots.automatic(collection,'__proto__'),/Invalid highlight slot/);
});

// Exercise the actual route and its preceding middleware with small dependency doubles.
function app(published=null){
  const stack=[],writes=[];
  const router={use:(fn)=>stack.push({fn}),get:(route,fn)=>stack.push({method:'GET',route,fn}),post:(route,fn)=>stack.push({method:'POST',route,fn})};
  const db={collection(name){return {
    async findOne(filter){
      if(name==='editor_sessions')return {expiresAt:new Date(Date.now()+1000)};
      return published && name==='articles' && published.status==='published' && filter.status==='published' && filter.reference===published.reference ? published : null;
    },
    async updateOne(...args){writes.push({name,args});return {matchedCount:1};}
  };}};
  const filename=path.resolve(__dirname,'../server/oilandgas/editor.js');
  const fakeRequire=name=>{
    if(name==='express')return {Router:()=>router,json:()=>((req,res,next)=>next())};
    if(name==='mongoose')return {connection:{useDb:()=>({db})}};
    if(name==='nodemailer')return {};
    if(name==='./industry-news')return {latest:async()=>[]};
    if(name==='./manuscript-text')return async()=>'';
    if(name==='./highlight-slots')return slots;
    if(name==='./weekly-picks')return require('../server/oilandgas/weekly-picks');
    return require(name);
  };
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{
    require:fakeRequire,module:{exports:{}},__dirname:path.dirname(filename),
    process:{env:{OIL_EDITOR_PASSWORD:'a-local-test-password'}},Buffer,URL,
    setInterval:()=>({unref(){}}),console:{warn(){},error(){}}
  },{filename});
  async function post(body,{session=true,origin=true,route='/highlight/automatic'}={}){
    const req={method:'POST',body,headers:{cookie:session?'__Secure-oilDesk='+'a'.repeat(64):''},
      get:key=>key==='host'?'editor.test':key==='Origin'&&origin?'https://editor.test':undefined,
      is:type=>type==='application/json'};
    let code=200,payload,ended=false;
    const res={set(){return this;},status(n){code=n;return this;},json(value){payload=value;ended=true;return this;},sendStatus(n){code=n;ended=true;return this;}};
    for(const layer of stack){
      if(ended)break;
      if(layer.fn.length===4)continue;
      if(layer.method&&(layer.method!=='POST'||layer.route!==route))continue;
      let error;
      await layer.fn(req,res,err=>{error=err;});
      if(error){code=error.status||500;payload={error:error.message};break;}
    }
    return {code,payload};
  }
  return {post,writes};
}

test('automatic selection requires an authenticated same-origin request',async()=>{
  const {post,writes}=app();
  assert.equal((await post({slot:'story2'},{session:false})).code,401);
  assert.equal((await post({slot:'story2'},{origin:false})).code,403);
  assert.equal(writes.length,0);
});

test('automatic selection validates the slot before writing',async()=>{
  const {post,writes}=app();
  for(const body of [{slot:'all'},{slot:{$ne:null}},{},null]){
    assert.equal((await post(body)).code,400);
  }
  assert.equal(writes.length,0);
  assert.equal((await post({slot:'story2'})).code,200);
  assert.equal(writes.length,1);
  assert.equal(writes[0].name,'homepage');
  assert.deepEqual(writes[0].args,[{_id:'highlights'},{$unset:{story2:''}}]);
});


test('weekly choices validate and authenticate before changing a separate document',async()=>{
  const {post,writes}=app({reference:'OG-A-TEST',status:'published',publication:{title:'Public article'},publicationId:'version-1'});
  const selection={slot:'field',kind:'articles',reference:'OG-A-TEST'};
  for(const route of ['/weekly-pick','/weekly-pick/automatic']){
    assert.equal((await post(selection,{route,session:false})).code,401);
    assert.equal((await post(selection,{route,origin:false})).code,403);
    assert.equal((await post({...selection,slot:'story1'},{route})).code,400);
  }
  assert.equal(writes.length,0);
  assert.equal((await post({...selection,reference:{$ne:null}},{route:'/weekly-pick'})).code,400);
  assert.equal((await post({...selection,reference:'PRIVATE'},{route:'/weekly-pick'})).code,404);
  assert.equal((await post(selection,{route:'/weekly-pick'})).code,200);
  assert.equal(writes.length,1);
  assert.equal(writes[0].args[0]._id,'weekly-picks');
  assert.deepEqual(Object.keys(writes[0].args[1].$set),['field']);
  assert.equal(writes[0].args[1].$set.field.publicationId,'version-1');
  assert.equal((await post({slot:'research'},{route:'/weekly-pick/automatic'})).code,200);
  assert.equal(writes[1].args[0]._id,'weekly-picks');
  assert.deepEqual(Object.keys(writes[1].args[1].$unset),['research']);
});
