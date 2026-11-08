'use strict';
// Jalan road geometry import. Dry-run is the default. Never logs credentials.
// Usage: node scripts/import-roads.js roads.json [--write]
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Road } = require('../server/jalan/road-pilot');
const args = process.argv.slice(2);
const write = args.includes('--write');
const file = args.find(a => !a.startsWith('--'));
const unknown = args.filter(a => a.startsWith('--') && a !== '--write');
if (!file || unknown.length) {
  console.error('Usage: node scripts/import-roads.js roads.json [--write]');
  process.exit(1);
}
const allowed = new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','motorway_link','trunk_link','primary_link','secondary_link']);
const bounds = { south: 3.10, north: 3.19, west: 101.65, east: 101.75 };
function parseRoads(input) {
  if (!Array.isArray(input.elements)) throw Error('Expected Overpass JSON elements array');
  const roads = new Map();
  const skipped = { nonRoad: 0, malformed: 0, outOfBounds: 0 };
  for (const el of input.elements) {
    if (el.type !== 'way' || !allowed.has(el.tags?.highway)) { skipped.nonRoad++; continue; }
    if (!Number.isSafeInteger(el.id) || !Array.isArray(el.geometry) || el.geometry.length < 2 || el.geometry.length > 10000) { skipped.malformed++; continue; }
    let geometry = el.geometry.map(p => [p.lon, p.lat]);
    if (geometry.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) { skipped.malformed++; continue; }
    if (el.tags.oneway === '-1') geometry.reverse();
    const xs = geometry.map(p => p[0]), ys = geometry.map(p => p[1]);
    const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    if (bbox[0] < bounds.west || bbox[2] > bounds.east || bbox[1] < bounds.south || bbox[3] > bounds.north) { skipped.outOfBounds++; continue; }
    roads.set('osm-way-' + el.id, {
      roadId: 'osm-way-' + el.id,
      name: String(el.tags.name || '').slice(0, 200),
      highway: el.tags.highway,
      oneway: ['yes','1','true','-1'].includes(el.tags.oneway) || el.tags.junction === 'roundabout' || ['motorway','motorway_link'].includes(el.tags.highway),
      maxspeed: String(el.tags.maxspeed || '').slice(0, 60),
      geometry,
      bbox
    });
  }
  if (roads.size > 5000) throw Error('Pilot limit is 5000 roads; narrow the export');
  return { roads: [...roads.values()], skipped };
}
async function main() {
  const input = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const { roads, skipped } = parseRoads(input);
  const summary = { mode: write ? 'WRITE' : 'DRY_RUN', target: 'jalan_navigation.pilot_roads', parsed: roads.length, skipped, bounds, sample: roads.slice(0, 5).map(({ roadId, name, highway, oneway }) => ({ roadId, name, highway, oneway })) };
  console.log(JSON.stringify(summary, null, 2));
  if (!write) { console.log('Dry run only. No MongoDB connection or writes performed.'); return; }
  if (!roads.length) throw Error('Refusing write: zero eligible roads');
  if (process.env.JALAN_IMPORT_CONFIRM !== 'jalan_navigation.pilot_roads') throw Error('Set JALAN_IMPORT_CONFIRM=jalan_navigation.pilot_roads to authorize writes');
  if (!process.env.MTERM2026_DB_URI) throw Error('MTERM2026_DB_URI missing');
  // Importer uses its own connection and explicit database selection.
  const conn = await mongoose.createConnection(process.env.MTERM2026_DB_URI, { dbName: 'jalan_navigation', serverSelectionTimeoutMS: 10000 }).asPromise();
  try {
    if (conn.name !== 'jalan_navigation') throw Error('Database mismatch; import aborted');
    // Reuse the pilot schema but bind to this explicit connection, avoiding MTerms default DB.
    const model = conn.model('JalanPilotRoadImport', Road.schema, 'pilot_roads');
    const ops = roads.map(r => ({ updateOne: { filter: { roadId: r.roadId }, update: { $set: r }, upsert: true } }));
    const result = await model.bulkWrite(ops, { ordered: false });
    console.log(JSON.stringify({ database: conn.name, collection: 'pilot_roads', upserted: result.upsertedCount, modified: result.modifiedCount, matched: result.matchedCount }));
  } finally { await conn.close(); }
}
main().catch(err => { console.error('Import failed:', err.message); process.exitCode = 1; });
