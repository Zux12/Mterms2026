'use strict';
// Isolated regression tests for the experimental V4.10.2 directed segment router.
// Run: node --test server/jalan/kl-segment-v4102.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculate, project, distance, noPathResponse } = require('./kl-segment-v4102');

function edge(id, from, to, a, b) {
  return { id, from, to, a, b, len: distance(a, b) };
}
function graph(edges) {
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e);
  }
  return { adj, edges };
}
function snap(e, t) {
  return { edge: e, t, point: [
    e.a[0] + (e.b[0] - e.a[0]) * t,
    e.a[1] + (e.b[1] - e.a[1]) * t
  ] };
}
const A = [3.14, 101.68], B = [3.14, 101.681], C = [3.141, 101.681];

test('projection onto segment clamps to its endpoints', () => {
  assert.equal(project(A, A, B).t, 0);
  assert.equal(project(B, A, B).t, 1);
  assert.ok(project([3.14, 101.6805], A, B).meters < 0.01);
});

test('same directed edge permits forward partial traversal', () => {
  const e = edge('ab', 'a', 'b', A, B);
  const result = calculate(graph([e]), snap(e, 0.2), snap(e, 0.8));
  assert.ok(result);
  assert.equal(result.edgeCount, 1);
  assert.ok(Math.abs(result.distanceMeters - e.len * 0.6) < 1);
  assert.equal(result.geometry.length, 2);
});

test('same directed edge rejects reverse travel without return path', () => {
  const e = edge('ab', 'a', 'b', A, B);
  assert.equal(calculate(graph([e]), snap(e, 0.8), snap(e, 0.2)), null);
});

test('reverse travel uses legal directed detour when available', () => {
  const ab = edge('ab', 'a', 'b', A, B);
  const bc = edge('bc', 'b', 'c', B, C);
  const ca = edge('ca', 'c', 'a', C, A);
  const result = calculate(graph([ab, bc, ca]), snap(ab, 0.8), snap(ab, 0.2));
  assert.ok(result);
  assert.equal(result.edgeCount, 4);
  assert.ok(result.distanceMeters > ab.len);
});

test('disconnected directed components yield no route', () => {
  const ab = edge('ab', 'a', 'b', A, B);
  const cd = edge('cd', 'c', 'd', C, [3.142, 101.681]);
  assert.equal(calculate(graph([ab, cd]), snap(ab, 0.3), snap(cd, 0.7)), null);
});

test('no-path response is explicitly experimental, read-only and carries sanitized stage timings',()=>{
 const timingMs={graphLoad:10,snapping:5,pathSearch:20,total:35};
 const response=noPathResponse(timingMs);
 assert.equal(response.ok,false);
 assert.equal(response.mode,'EXPERIMENTAL_SEGMENT_ROUTE');
 assert.equal(response.error,'No directed path found');
 assert.equal(response.routingActivated,false);
 assert.equal(response.databaseWrites,0);
 assert.equal(response.trafficAware,false);
 assert.equal(response.legalDrivingRouteVerified,false);
 assert.equal(response.accessRestrictionsEnforced,false);
 assert.equal(response.turnRestrictionsEnforced,false);
 assert.equal(response.timingDiagnosticOnly,true);
 assert.deepEqual(response.timingMs,timingMs);
 assert.ok(!('geometry' in response));
});

test('real imported KL four-edge service-road witness is routed by calculate on an isolated fixture',()=>{
 // Coordinates and directed node IDs were read from Atlas road_graph_edges_v495.
 // This is an actual imported-road fixture, NOT a full-graph/road-legality test.
 const records=[
  ['osm-way-1161236396:0:F','5738558701','5738558702',[101.7038508,3.1315707],[101.7036171,3.130908]],
  ['osm-way-1161236398:0:F','5738558702','10800536677',[101.7036171,3.130908],[101.7037223,3.1308854]],
  ['osm-way-1161236397:2:R','10800536677','10800536676',[101.7037223,3.1308854],[101.7039025,3.1313468]],
  ['osm-way-1161236397:1:R','10800536676','10800536675',[101.7039025,3.1313468],[101.7038951,3.1314573]]
 ];
 const imported=records.map(([id,from,to,a,b])=>edge(id,from,to,[a[1],a[0]],[b[1],b[0]]));
 const route=calculate(graph(imported),snap(imported[0],0),snap(imported[3],1));
 assert.ok(route,'the imported directed witness must be reachable');
 assert.ok(route.distanceMeters>=150&&route.distanceMeters<=165);
 assert.equal(route.geometry[0][0],101.7038508);
 assert.equal(route.geometry[0][1],3.1315707);
 assert.deepEqual(route.geometry.at(-1),[101.7038951,3.1314573]);
 assert.equal(route.geometryGapsOver2Meters??0,0);
});
