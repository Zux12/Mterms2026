'use strict';
// Synthetic reverse-arc regression for the isolated KL preview. These tests do
// not establish turn/access legality or full-map performance.
const test=require('node:test');
const assert=require('node:assert/strict');
const {nearest,calculate,distance}=require('./kl-segment-v4102');
const A=[3.14,101.68],B=[3.14,101.681];
function edge(id,from,to,a,b){
 return {id,from,to,a,b,len:distance(a,b)};
}
function graph(edges){
 const adj=new Map();
 for(const e of edges){if(!adj.has(e.from))adj.set(e.from,[]);adj.get(e.from).push(e);}
 return {adj,edges};
}
test('nearest identifies opposite imported arcs only when directed nodes and geometry reverse',()=>{
 const ab=edge('ab','a','b',A,B),ba=edge('ba','b','a',B,A);
 const s=nearest([ab,ba],[3.14,101.6809]);
 assert.equal(s.edge,ab);
 assert.equal(s.reverseTwin.edge,ba);
 assert.ok(s.ambiguousSnap);
 assert.equal(s.candidatesWithin200,2);
});
test('reverse physical journey uses the reverse arc instead of detouring forwards then around',()=>{
 const ab=edge('ab','a','b',A,B),ba=edge('ba','b','a',B,A),g=graph([ab,ba]);
 const source=nearest(g.edges,[3.14,101.6809]),target=nearest(g.edges,[3.14,101.6801]);
 const r=calculate(g,source,target);
 assert.ok(r);
 assert.equal(r.distanceMeters,Math.round(ab.len*0.8));
 assert.equal(r.edgeCount,1);
 assert.equal(r.advisoryEdgesInspected,1);
 assert.ok(Math.abs(r.geometry[0][0]-101.6809)<1e-9);
 assert.ok(Math.abs(r.geometry.at(-1)[0]-101.6801)<1e-9);
});
test('forward travel still uses the direct forward arc',()=>{
 const ab=edge('ab','a','b',A,B),ba=edge('ba','b','a',B,A),g=graph([ab,ba]);
 const r=calculate(g,nearest(g.edges,[3.14,101.6801]),nearest(g.edges,[3.14,101.6809]));
 assert.ok(r);
 assert.equal(r.distanceMeters,Math.round(ab.len*0.8));
 assert.equal(r.edgeCount,1);
});
test('parallel coincident arcs with unrelated node identities are not reverse twins',()=>{
 const ab=edge('ab','a','b',A,B),unconnected=edge('other','x','y',B,A);
 const s=nearest([ab,unconnected],[3.14,101.6805]);
 assert.equal(s.reverseTwin,null);
 assert.ok(s.ambiguousSnap);
});
test('displaced reverse geometry does not create a road-teleport shortcut',()=>{
 const ab=edge('ab','a','b',A,B);
 const shift=[0.00002,0];
 const moved=e=>[e[0]+shift[0],e[1]+shift[1]];
 const displaced=edge('bad','b','a',moved(B),moved(A));
 const s=nearest([ab,displaced],[3.14,101.6805]);
 assert.equal(s.reverseTwin,null);
});
test('one-way roads without a reverse twin still forbid backwards travel',()=>{
 const ab=edge('ab','a','b',A,B),g=graph([ab]);
 const source=nearest(g.edges,[3.14,101.6809]),target=nearest(g.edges,[3.14,101.6801]);
 assert.equal(source.reverseTwin,null);
 assert.equal(calculate(g,source,target),null);
});
