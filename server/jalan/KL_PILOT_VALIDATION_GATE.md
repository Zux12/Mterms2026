# JALAN V4.10.2 — KL pilot validation gate

This checklist applies to the **experimental, read-only** directed segment-routing preview. It is not authorization to replace TomTom.

## Automated checks
- [x] Directed edges, partial-edge starts/ends, junction connectivity, disconnected crossings, and zero-distance GeoJSON covered by isolated unit tests.
- [x] Differential synthetic shortest-path comparison against an independent Bellman–Ford reference.
- [x] Synthetic large-graph performance measurement completed (not representative of actual KL roads).
- [x] Route-coordinate gap advisory detects displaced endpoints even when imported directed graph node IDs connect (synthetic regression plus sampled KL chain).
- [x] Audit coordinate consistency across **every imported KL graph-node endpoint** (168,221 directed edges, 336,442 endpoint observations, 103,670 unique node IDs). Every same-ID observation had identical coordinates. This validates imported node-coordinate consistency, **not** physical road connectivity or route legality.
- [x] Synthetic route-plausibility advisory tests: detour ratio, impossible below-geodesic distance, near-zero baseline and integration. These checks never establish legal driving suitability.
- [ ] Re-run GitHub Actions against the final proposed commit and capture run IDs.

## Read-only KL edge identity preflight (11 November 2026)
- Examined **all 168,221 documents** in `jalan_navigation.road_graph_edges_v495` through MongoDB Atlas **read-only aggregations**: grouping by `edgeId` produced **zero duplicate IDs** (including forward/reverse directed records).
- Separate full-collection structural aggregation found **zero** missing/non-string `edgeId` values; **zero** missing `fromNode` or `toNode`; and **zero** records whose top-level `coordinates` array has a length other than two.
- The preview graph loader now rejects duplicate or empty/non-string directed IDs instead of accepting a cardinality-only check. This is an in-memory fail-closed guard; no MongoDB indexes, records, schemas, or production routes were changed.
- Additional read-only full-collection aggregation found **zero** nonnumeric endpoint values, **zero** malformed nested coordinate pairs and **zero** coordinates outside global WGS84 latitude/longitude bounds. These checks are data-shape validation, **not** precision, consistency or road-legality verification.
- **Still outstanding:** mismatched endpoint coordinates across all graph adjacencies, genuine on-road GPS snapping, representative full routes and turn legality. A zero-duplicate result does not establish route correctness.

## Full-network directed-node geometry audit (11 November 2026)

- Ran a **read-only MongoDB Atlas aggregation** against the complete `jalan_navigation.road_graph_edges_v495` collection. For each directed edge, projected its `fromNode`/start coordinate and `toNode`/end coordinate; combined both endpoint streams; grouped by node identifier; compared latitude/longitude minimum and maximum per node. A longitude/latitude bounding-box diagonal in metres acts as a conservative **upper bound** on within-node endpoint spread.
- Scope: **168,221** directed edges, **336,442** endpoint observations, **103,670** distinct graph nodes, including **102,676** nodes observed more than once. Nodes with spread upper bound >2 m: **0**; >10 m: **0**; maximum recorded upper bound: **0 m**.
- Independent randomized read-only adjacency spot-check: **1,000** sampled inbound directed edges, **1,909** corresponding outbound transitions; **3** inbound samples had no outbound edge. Among the connected pairs, **0** geometry gaps >2 m; maximum **0 m**. This is a topology observation, not an assertion that every dead end is wrong.
- Separate collection-wide shape observations: **zero** equal start/end-coordinate edges; **zero** equal from/to node IDs; **zero** directed edges over 1 km based on approximate chord distance (maximum approximately **870 m**). These do not establish map completeness or route realism.
- New isolated in-memory `kl-node-geometry-audit-v4102.js` computes and exposes a conservative coordinate-spread advisory when the experimental KL graph loads. Malformed or empty input produces **unknown/null**, never a false zero. Synthetic regressions test exact matches, node coordinate shifts, bounded spread, disconnected IDs and malformed records.
- Data provenance: OpenStreetMap contributors (ODbL), imported v495. This audit validates **internal imported node-coordinate coherence only**. It does not prove that node identities correspond to lawful street junctions, road geometry is geographically accurate, restrictions are applied, or that the graph can provide safe navigation.
- All operations on Atlas were read-only. No user GPS traces, secrets, MTERMS records, MongoDB writes, production merges or TomTom routing changes.

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

## Experimental snapped-route plausibility review (11 November 2026)

- Added an **advisory-only** comparison of computed route length with geodesic distance between *snapped* road locations. A route 4× or more the geodesic can trigger `routeDetourReviewCandidate`; a route substantially **shorter** than geodesic (allowing the greater of 1% or 2 m tolerance) triggers `routeTooShortReviewCandidate`. Both are heuristics, not driving-law or route-quality verdicts.
- For snapped endpoints closer than **100 m**, ratios and warning flags are `null` (unknown), since near-zero denominators magnify benign detours. Malformed values also fail closed. `routePlausibilityAdvisoryOnly:true`.
- No snapping, path selection, routing cost, real-time ETA, TomTom API, database or production behavior changes. The tool requires **real-world KL journeys** to calibrate thresholds and assess false positives. A long legal one-way/bridge detour is not necessarily an algorithm error.

## Reproducible 20-journey evidence gate (11 November 2026)

Use `node server/jalan/validate-kl-pilot.js cases.json` on **anonymized, independently reviewed** KL pilot journey observations. The checker is offline and read-only; it does not call Heroku, Atlas, TomTom, or the experimental router. No real-road case evidence has been collected by these synthetic tests.

Each case requires a unique `caseId`, `journeyType`, independent `expectedReachable` boolean, observed `ok` boolean, and nonnegative `elapsedMs`. Successful routes additionally require `distanceMeters`, `startSnapMeters`, `endSnapMeters` (each within 200 m) and `geometryContinuous: true`. A deliberately unreachable case requires `disconnectionReviewed: true` to distinguish expected no-path evidence from an unexplained routing failure. Record independent evidence for reachability and geometry before setting these flags; do not infer validity from the same router under test.

Use at least **20 distinct cases** covering `short-urban`, `long-corridor`, `one-way`, `overpass`, and `disconnected`. The CLI reports snap median, p95 and maximum, missing categories, unexpected no-path results, and reasoned validation errors. Exit codes: **0** for structurally complete 20-case evidence only; **1** for malformed/contradictory evidence; **2** for valid but incomplete case coverage. All outcomes explicitly report `manualRoadSafetyReviewRequired:true` and `productionRoutingAuthorized:false`.

Nine **synthetic** CLI regression tests exercise these fail-closed semantics. Passing the automated evidence gate never proves driving legality, full-network connectivity, traffic accuracy, satisfactory latency, or production readiness. Independent review against real roads and current traffic/turn rules is still mandatory; retain TomTom as production.

## Directed graph weak-connectivity preflight (11 November 2026)

- Added a **read-only, in-memory** graph-topology diagnostic to the isolated KL preview. After graph load, it counts source-only nodes (outgoing but no incoming arc), sink-only nodes (incoming but no outgoing arc), weakly connected components, components with fewer than five nodes, and size/edge share of the largest weak component. Results appear in experimental route output and in the cached graph's health response. The initial health response can report `graphTopology:null` before the first route has loaded the graph.
- **Weak connectivity does not imply directed reachability.** A one-way street can connect nodes in the undirected sense even when the reverse trip is impossible. Source-only and sink-only nodes can be legitimate road endpoints; small components may be parking, service, private, or disconnected fragments. None of these counts proves a defective junction or safe/legal route.
- If input is empty or invalid, counts are `null` with `graphTopologyAvailable:false`, not a false zero; outputs explicitly retain `topologyAdvisoryOnly:true` and `directedReachabilityVerified:false`.
- Seven synthetic regression tests cover one-way chains, cycles, disconnected fragments, bidirectional arcs, duplicate arcs/self-loops, malformed input and a 5,000-edge chain. **The live 168,221-edge KL graph topology has not been computed in this run**, because Atlas cluster address resolution failed. Inspect real weak components and directed source/sink nodes when read-only Atlas connectivity is restored, then review representative road endings against OSM junctions and actual access rules.
- No change to Dijkstra routing, snapping, turn enforcement, TomTom, production deployment or MongoDB records. **Do not merge or deploy for navigation.**

## Overall milestone tracker (maintained as CI evidence arrives)

Tick a milestone **only after verifying its own acceptance evidence**. A synthetic test does not close a real-road milestone.

- [x] Original terminal diagnostic token-storage request returned HTTP 201 with `stored:true` (previous operator observation; not a fresh live-service check).
- [x] Experimental directed routing and regression test framework implemented.
- [x] Differential shortest-path and synthetic large-graph tests implemented and previously verified.
- [x] Read-only KL edge-identity and node-coordinate audits documented with complete-collection observations.
- [x] Offline 20-journey structural evidence gate implemented; missing coverage never authorizes production routing.
- [x] CI verified for commit `70e99dca54e48aebe167a0da6dd52814758e7d1e`: routing run `42978554365` succeeded; diagnostic run `42978554238` succeeded.
- [ ] CI verified for the latest proposed commit (must refresh for every new commit).
- [ ] Full KL graph health and load time rechecked in a live read-only environment.
- [ ] Twenty independently reviewed actual KL origin–destination journeys completed.
- [ ] GPS snapping error percentiles and ambiguity cases measured on real KL journeys.
- [ ] Full-graph connectivity and no-path cases reviewed against actual roads.
- [ ] Turn and access restrictions independently checked and enforced for legal driving.
- [ ] Actual KL routing latency and memory benchmark accepted.
- [ ] TomTom route-distance and traffic-aware ETA comparisons completed.
- [ ] KL pilot safety and quality acceptance signed off.
- [ ] Peninsular Malaysia coverage and performance validated.
- [ ] Sabah/Sarawak rollout considered only after Peninsular Malaysia acceptance.

**Progress accounting:** Automated regression completion and database shape audits are not substitutes for route legality, user-facing navigation quality, or production acceptance. Keep TomTom authoritative.
