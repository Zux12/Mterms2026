# JALAN V4.10.2 — KL pilot validation gate

This checklist applies to the **experimental, read-only** directed segment-routing preview. It is not authorization to replace TomTom.

## Automated checks
- [x] Directed edges, partial-edge starts/ends, junction connectivity, disconnected crossings, and zero-distance GeoJSON covered by isolated unit tests.
- [x] Differential synthetic shortest-path comparison against an independent Bellman–Ford reference.
- [x] Synthetic large-graph performance measurement completed (not representative of actual KL roads).
- [x] Route-coordinate gap advisory detects displaced endpoints even when imported directed graph node IDs connect (synthetic regression plus sampled KL chain).
- [ ] Audit geometry gap counts/distribution on the complete KL graph; zero synthetic or sampled gaps is **not** full-network validation.
- [ ] Re-run GitHub Actions against the final proposed commit and capture run IDs.

## Read-only KL edge identity preflight (11 November 2026)
- Examined **all 168,221 documents** in `jalan_navigation.road_graph_edges_v495` through MongoDB Atlas **read-only aggregations**: grouping by `edgeId` produced **zero duplicate IDs** (including forward/reverse directed records).
- Separate full-collection structural aggregation found **zero** missing/non-string `edgeId` values; **zero** missing `fromNode` or `toNode`; and **zero** records whose top-level `coordinates` array has a length other than two.
- The preview graph loader now rejects duplicate or empty/non-string directed IDs instead of accepting a cardinality-only check. This is an in-memory fail-closed guard; no MongoDB indexes, records, schemas, or production routes were changed.
- **Still outstanding:** numeric endpoint values and geographic bounds across the *entire* graph, mismatched endpoint coordinates for every adjacency, actual on-road GPS snapping, representative full routes and turn legality. A zero-duplicate result does not establish route correctness.

## Real KL graph — must verify before merge
- [ ] Read-only health confirms expected `road_graph_edges_v495` count (168,221) in `jalan_navigation`.
- [ ] Cold graph load and warm route latency measured with representative KL origin/destination pairs.
- [ ] At least 20 origin/destination pairs, including short urban trips, longer corridors, one-way streets, overpasses and disconnected roads.
- [ ] Snap-distance distribution (median, p95, max, and >200 m failures) recorded.
- [ ] Confirm GeoJSON geometry continuity and direction against the road network; log `geometryGapCountOverThreshold`, `geometryMaxGapMeters`, `geometryGapTransitionsInspected` (default 2 m alert threshold), investigate every mismatch.
- [ ] Review no-path and ambiguous snapping cases; never silently present an illegal route.
- [ ] Independently verify actual road restrictions; node adjacency alone does **not** enforce turn prohibitions.
- [ ] Compare distances and plausible journey paths with TomTom; do not treat illustrative 30 km/h ETA as real traffic-aware ETA.

## Production safeguards
- Keep PR in draft until actual-road validation is reviewed.
- Do not merge, deploy, or switch the live routing engine.
- Do not alter the original MTERMS data, traffic collection, or TomTom API behavior.
- Prioritize Peninsular Malaysia only after the KL pilot is validated.

## Evidence format for each real-road case
Record anonymized case ID, origin/destination coordinates, graph version, snap distances, route distance, result/no-path, elapsed milliseconds, geometric continuity, suspected restrictions, and reviewer conclusion. Avoid storing user GPS traces or credentials in Git.
