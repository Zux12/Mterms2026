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
