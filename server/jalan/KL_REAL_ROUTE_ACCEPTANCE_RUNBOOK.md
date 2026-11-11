# KL real-route acceptance runbook (experimental, read-only)

This is the **next test milestone**, not evidence that real routes have been tested. It is designed to avoid repeating the completed terminal connectivity setup.

## Execution boundary

Use the already-established authenticated experimental preview route, never the production TomTom endpoint. Keep the branch and PR draft. Do not store API tokens, user GPS tracks or MongoDB credentials in Git.

For each independently chosen origin/destination pair, record only anonymized case IDs and public road-level locations. Compare with independently inspected road topology and current TomTom directions. Do **not** infer legal turns from the preview itself.

## Minimum 20-case matrix

| Journey type | Required cases | Evidence required |
|---|---:|---|
| Short urban | 4 | Snap accuracy, path continuity, junctions |
| Long corridor | 4 | Route distance, latency, memory |
| One-way | 4 | Direction and independently checked signs/turns |
| Overpass | 4 | No false connection between grade-separated roads |
| Disconnected | 4 | Independently documented expected reachability |

Every case requires: `caseId`, `journeyType`, `expectedReachable`, `ok`, `elapsedMs`, and for successful routes `distanceMeters`, `startSnapMeters`, `endSnapMeters`, `geometryContinuous`. Expected no-path cases require `disconnectionReviewed:true`. The existing `validate-kl-pilot.js` checks evidence shape, not legal driving suitability.

## Results checklist

- [ ] 20 actual independent origin/destination cases selected, with map-source timestamps.
- [ ] Experimental route endpoint tested for each case (read-only).
- [ ] Every unexpected no-path and snap ambiguity investigated.
- [ ] Median/p95/max snap distance and p50/p95 latency calculated.
- [ ] Route geometry and direction checked against actual roads.
- [ ] Turn, access and grade-separation restrictions reviewed independently.
- [ ] TomTom route comparison recorded (distance, route path and traffic-aware ETA).
- [ ] Acceptance gate executed against evidence and outputs archived.
- [ ] Human road-safety review completed; **no automatic production authorization**.

**Important:** A synthetic set of 20 structurally valid records must not be substituted for actual journeys. KL is a pilot; the intended subsequent scope is Peninsular Malaysia, then Sabah/Sarawak after acceptance.

## Live directed-edge traversal preflight — 11 November 2026

- [x] Reconnected to the existing MongoDB Atlas cluster containing `jalan_navigation.road_graph_edges_v495` without changing records.
- [x] Ran a bounded read-only `$graphLookup` beginning at imported edge `osm-way-1161236396:0:F` from source-only node `5738558701`, following `toNode → fromNode` with `maxDepth:2`.
- [x] Query returned **five downstream edge records**, including repeated destination node IDs, with no query output truncation. This verifies a small real directed graph traversal, **not** full-route navigation, legal road connectivity, or 20-case acceptance.
- [ ] Execute complete origin-to-destination routes through the experimental preview against the full 168,221-edge graph.
- [ ] Record independent ground truth, route geometry, snap errors, latency and TomTom comparison for all 20 journeys.

This preflight is not a substitute for the route endpoint: `$graphLookup` verifies directed database connectivity only. No production traffic or routing changes.

## Execute real experimental routes without publishing GPS or credentials

The isolated `collect-kl-route-evidence.js` CLI performs **sequential, read-only** GETs against an operator-supplied **experimental** `/route` endpoint. It requires that HTTP 200 responses explicitly identify `EXPERIMENTAL_SEGMENT_ROUTE`, report `routingActivated:false`, `databaseWrites:0`, `trafficAware:false`, and both access/turn restrictions as **not enforced**. This rejects TomTom/production or malformed responses. An HTTP 404 is accepted as no-path evidence **only** with `ok:false,error:"No directed path found"`; HTTP 401/403/422/5xx/redirects/transport errors must not count as disconnections.

Store a **private, uncommitted** JSON array of genuine independently selected journeys. Required input fields per case: `caseId`, `journeyType` (one of the five types above), `expectedReachable` (determined independently), `startLat`, `startLng`, `endLat`, `endLng`. Cases expected to be unreachable also need `disconnectionReviewed:true` from a prior independent map/access review. Do **not** infer this flag from the router's 404 response. Do not include addresses, vehicle identifiers, user names or confidential GPS tracks in case IDs.

On the authorized operator machine, set `JALAN_EXPERIMENTAL_ROUTE_URL` to the **existing verified experimental** URL ending in `/route`. If needed, set `JALAN_AUTH_HEADER` to the actual configured header name and supply `JALAN_AUTH_VALUE` securely without putting the value in a command line, repository, or chat. Run:

```sh
node server/jalan/collect-kl-route-evidence.js /secure/kl-cases.private.json /secure/kl-results.sanitized.json
```

The collector deliberately **does not store or print** origin/destination coordinates, URL, request headers, response bodies, or credentials. It writes a new private `0600`-mode results file and runs `validate-kl-pilot.js`. The output cannot silently overwrite a prior result. Do not commit the input or output. The script cannot run without an accessible experimental endpoint and valid authentication.

The structural gate now requires **at least 20 actual cases, at least four per journey type**, and **at least two independently expected reachable positive controls** in each routed-road class (short urban, long corridor, one-way, overpass). One-way and overpass classes can still include legitimate independently reviewed negative controls. Cases classified as disconnected must be independently expected unreachable; twenty reviewed HTTP 404s cannot substitute for evidence of working routes. It also requires an explicit `responseStatus`: HTTP 200 for a successful route or the specific HTTP 404 for an independently reviewed disconnected route. It reports per-type case counts and p50/p95/max elapsed milliseconds, together with snap statistics. A successful CLI exit means only **structural evidence completeness**, never verified legal driving or production authorization.

For a successful route, the collector sets `geometryContinuous:true` only when returned GeoJSON coordinates are structurally valid **and** the preview's existing ≤2 m graph-transition gap audit reports zero excessive gaps. This check does not verify traffic rules, correct road snapping, grade-separated junctions or map provenance. Any access/turn warnings, snap ambiguity, unusual detours or source restrictions still require manual review.

**Automation checkpoint, 11 November 2026:** verified [185/185 routing/collector/acceptance regressions passed](https://github.com/Zux12/Mterms2026/actions/runs/43001142898) and [diagnostics passed](https://github.com/Zux12/Mterms2026/actions/runs/43001141650) for commit `82c570f8b1ff1fdb3381717c3532e720fbd04ca8`. These are *offline/mocked tests*, not real route execution. The runbook documentation commit needs its own CI.

## Three-branch directed traversal checkpoint — 11 November 2026

Read-only Atlas `$graphLookup` started at all three imported outgoing edges of OSM node `5738558701`, with `maxDepth:6`. The query projected only the start edge, destination, downstream edge count and maximum observed depth.

| Imported start edge | Downstream edge records | Maximum depth observed |
|---|---:|---:|
| `osm-way-1161236396:0:F` | 11 | 6 |
| `osm-way-1161236395:0:F` | 27 | 6 |
| `osm-way-604900312:0:F` | 15 | 6 |

- [x] Bounded directed traversal on three actual KL branches completed read-only.
- [ ] Measure full experimental route endpoint latency, GPS snapping and geometry for real origin/destination pairs.
- [ ] Independently review legal road restrictions and 20 journey cases.

**Caution:** Maximum observed depth equals the query limit; it is not a measurement of maximum reachable path length. These are reachable **edge-record counts**, not distinct road nodes or complete navigable journeys. No live route or TomTom behavior changed.

## Full-network export preflight — 12 November 2026

A read-only Atlas aggregation was attempted to fetch all 168,221 directed KL edges in seven 25,000-record pages for an independent full-graph route calculation. **The connector enforced `config.maxDocumentsPerQuery` and returned only 1,000 documents in the first page**, so the attempted snapshot was intentionally discarded. **No complete route was calculated or accepted.**

- [x] Confirm connector query cap and fail closed on incomplete graph extraction
- [ ] Run full-graph route calculation in a controlled environment with access to all edges, using the existing experimental preview or a validated full export
- [ ] Collect cold/warm route timing and independent 20-journey evidence

Do not silently concatenate truncated pages or claim a partial graph is the complete network. This limit concerns the connected query interface, not the road data itself.

## Actual KL directed origin-to-destination connectivity evidence — 12 November 2026

A read-only Atlas aggregation located imported start edge `osm-way-1161236396:0:F` (`5738558701 → 5738558702`) and used a bounded `$graphLookup` to retrieve downstream directed edge records. The result contained 15 reachable records, with target node `10800536675` present. The returned edge IDs and directed node transitions independently support the following **five-edge** imported-graph path:

1. `osm-way-1161236396:0:F`: `5738558701 → 5738558702`
2. `osm-way-1161236398:0:F`: `5738558702 → 10800536677`
3. `osm-way-1161236397:2:R`: `10800536677 → 10800536676`
4. `osm-way-1161236397:1:R`: `10800536676 → 10800536675`

**Correction:** The actual reconstructed path consists of **four** directed edges, as enumerated above. The 15-record traversal includes other reachable arcs, not 15 path edges. This path is a directed reachability witness, **not** a shortest-path proof or road-legality review.

- [x] One actual imported KL origin-to-destination **directed connectivity witness** established through read-only database query
- [ ] Execute that origin/destination through the experimental full-graph `/route` implementation, measure distance/latency and compare geometry
- [ ] Independently check road direction/access and current OSM map data
- [ ] Complete the full 20-case independently reviewed KL acceptance set

No driver GPS, credentials, MongoDB writes, production merge or TomTom routing changes.

## Actual imported-graph geometry witness — 12 November 2026

A second **read-only** Atlas aggregation retrieved the actual `coordinates` arrays of the four directed edges from `5738558701` to `10800536675` listed in the earlier connectivity witness. Each edge has two coordinate points. Independent haversine summation over those four edges gives approximately **157 metres**, with **0 metres** of coordinate discontinuity at all three joins. Start `[101.7038508, 3.1315707]`, end `[101.7038951, 3.1314573]` (longitude, latitude). All four imported records are tagged `highway=service` and have empty `access` metadata.

- [x] Reconstructed actual directed edge geometry and verified all three coordinate joins
- [x] Computed approximate **157 m** imported-graph witness length from real stored coordinates
- [ ] Confirm whether this service-road path is legally driveable, open to the public, and relevant to an independently selected real journey
- [ ] Confirm whether the full experimental routing engine returns this path and actual route latency
- [ ] Independently review 20 actual KL journeys

**Interpretation:** The 157 m is the length of this specific directed connectivity witness, not a verified shortest driving route, not a TomTom ETA, and not a route-engine benchmark. Start and end coordinates are imported OSM node coordinates, not user GPS traces. Do not count this witness as one of the 20 independently reviewed acceptance journeys.
