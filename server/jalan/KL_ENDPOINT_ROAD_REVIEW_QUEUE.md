# KL endpoint road-level review queue — 11 November 2026

**Status: NOT REVIEWED.** This queue translates previously audited, public OSM graph endpoint candidates into a reproducible independent road-level investigation. It does not label any road defective and does not establish safe driving routes.

Data source: `jalan_navigation.road_graph_edges_v495`, prior read-only endpoint aggregation; OpenStreetMap contributors (ODbL). Coordinates below are **imported public road-node coordinates**, not driver GPS positions.

| OSM node ID | Imported class | In | Out | Longitude | Latitude | Independent road review |
|---|---|---:|---:|---:|---:|---|
| 5738558701 | source-only | 0 | 3 | 101.7038508 | 3.1315707 | [ ] |
| 11305000094 | source-only | 0 | 2 | 101.7103802 | 3.1433230 | [ ] |
| 11921503726 | source-only | 0 | 2 | 101.6652293 | 3.1105581 | [ ] |
| 12469319673 | sink-only | 2 | 0 | 101.7185481 | 3.1396225 | [ ] |
| 13246999063 | sink-only | 2 | 0 | 101.7194419 | 3.1421348 | [ ] |
| 1466762606 | sink-only | 2 | 0 | 101.7208629 | 3.1387100 | [ ] |

## Review protocol

For each candidate, record **all** of the following before ticking its review cell:

1. Confirm the OSM node and connected way IDs against a current, independent map extract. Record source and timestamp.
2. Inspect directed incoming/outgoing geometry, road classification, access tags, one-way tags, nearby barriers, junction connections and whether the point lies at an extract boundary.
3. Compare with authoritative or observable street-level evidence where available; do not infer legal permissions from the imported topology.
4. Classify: `legitimate-one-way-or-dead-end`, `extract-boundary`, `suspected-import-gap`, or `unresolved`. Explain the evidence and confidence.
5. For a suspected gap, create a **new isolated test fixture** using only public road data, with expected direction and an independently justified connection. Do not edit MongoDB or production routing.
6. Keep a separate unresolved list and do not mark the **road-level endpoint review** milestone complete until the reviewed sample is documented.

**Current evidence:** two candidate IDs were cross-checked against read-only imported edges for degree and coordinate consistency; **zero** candidates have independently verified road-level legality or map completeness. This document is a review queue, not an acceptance report.

## Milestone accounting

- [x] Full-graph endpoint screening completed: 496 source-only, 519 sink-only nodes (prior read-only audit)
- [x] Initial six representative candidates captured with imported coordinates
- [ ] Independent road-level review of these six candidates
- [ ] Classification and targeted regressions for any confirmed import defects
- [ ] Representative 20 real KL journey acceptance gate

Production TomTom remains authoritative; no merge or deployment is authorized.

## Independent-source lookup status

The public OpenStreetMap documentation confirms that node identifiers are stable OSM object identifiers and that node pages are addressable by `https://www.openstreetmap.org/node/<id>`. General web searches did **not** return node-specific road/way/tag evidence for these six IDs; therefore **none** has been classified as verified.

Direct review links (these are lookup entry points, **not evidence that the current OSM object was retrieved**):

- [Source candidate 5738558701](https://www.openstreetmap.org/node/5738558701)
- [Source candidate 11305000094](https://www.openstreetmap.org/node/11305000094)
- [Source candidate 11921503726](https://www.openstreetmap.org/node/11921503726)
- [Sink candidate 12469319673](https://www.openstreetmap.org/node/12469319673)
- [Sink candidate 13246999063](https://www.openstreetmap.org/node/13246999063)
- [Sink candidate 1466762606](https://www.openstreetmap.org/node/1466762606)

**Review blocker:** retrieve independent node/parent-way details and relevant tags or a timestamped OSM extract before classifying any node. Do not assume public map search snippets are road-level verification.

## Fresh read-only imported-edge inspection — 11 November 2026

Connected to the existing Atlas cluster containing `jalan_navigation`. A bounded, **read-only** `find` with six candidate node IDs and explicit field projection returned **13** directed edges. This is fresh evidence about the imported graph, **not an independent OSM map or signage review**.

| Node | Imported endpoint | Directed edges returned | Imported `highway` tags | Way IDs parsed from edge IDs |
|---|---|---:|---|---|
| 5738558701 | source-only | 3 outgoing | service (3) | 1161236396, 1161236395, 604900312 |
| 11305000094 | source-only | 2 outgoing | service (2) | 1220066418, 1321780545 |
| 11921503726 | source-only | 2 outgoing | service (2) | 1285076371, 1348864760 |
| 12469319673 | sink-only | 2 incoming | service (2) | 1227811696, 1229005328 |
| 13246999063 | sink-only | 2 incoming | service (2) | 1228621320, 1230915600 |
| 1466762606 | sink-only | 2 incoming | motorway_link (1), secondary (1) | 1221539413, 291026091 |

All 13 records showed empty `access`, `vehicle`, and `motorVehicle` values in the projected fields. **Empty values are not evidence of unrestricted legal access.** The edge IDs embed OSM way identifiers, but the current OSM parent ways and tags have not been independently fetched.

- [x] Read-only query of all six candidate endpoints and their imported incident edges
- [x] Imported road classes and way identifiers recorded for further review
- [ ] Independent OSM parent-way and road-signage verification
- [ ] Classify endpoints and establish any actual missing connection

**Priority:** inspect node `1466762606` first because it combines a motorway link and secondary road at a sink-only imported endpoint; that is a *review priority*, not proof of a mapping error. Do not alter routing or data on this basis.

## Priority sink-node upstream trace — 11 November 2026

A fresh read-only query expanded node `1466762606` to its immediate predecessors `11329290039` and `2944902632`. Four imported directed edges were found:

- `11329290038 → 11329290039 → 1466762606`: two consecutive `motorway_link` segments (OSM ways `1221539412`, `1221539413`).
- `5940535316 → 2944902632 → 1466762606`: two consecutive `secondary` segments (OSM ways `166734461`, `291026091`).

Both paths terminate at the same imported node coordinate **(101.7208629 E, 3.1387100 N)**. The observed directed graph has no outgoing arc from this sink node, but these imported edges alone do not establish why. This may reflect import truncation, road access, direction tags or genuine road configuration.

- [x] Trace both immediate upstream imported paths to priority sink node
- [ ] Retrieve current OSM node and way tags independently
- [ ] Determine whether the sink is a legitimate road end or an import/topology defect
- [ ] If confirmed defective, create isolated regression and propose an import fix without modifying the live database

**No road defect is confirmed.** The source remains the existing imported graph; the review must not be marked independently complete.
