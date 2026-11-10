'use strict';
const assert = require('node:assert/strict');
const { validate } = require('./routing-diagnostics');

const valid = validate({experiment_id:'step749-kl',start_node:134009,
  goal_node:6662320,snap_distance_m:36.84,route_minutes:130.081,
  reached:true,strategy:'FAST_PATH'});
assert.ok(valid);
assert.equal(valid.source,'jalan_experimental_backend');
assert.ok(valid.recorded_at instanceof Date);
for (const bad of [
  {}, {experiment_id:'bad',latitude:3.1}, {experiment_id:'bad',start_node:-1},
  {experiment_id:'bad',start_node:true}, {experiment_id:'bad',reached:'true'},
  {experiment_id:'bad',route_minutes:Infinity},
  {experiment_id:'bad',snap_distance_m:NaN},
  {experiment_id:'bad',notes:'x'.repeat(301)}
]) assert.equal(validate(bad),null);
console.log('Jalan diagnostic validation: PASS (no MongoDB writes)');
