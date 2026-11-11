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
