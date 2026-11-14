# JALAN KL — Destination-Access Road Review 01
**Status:** EVIDENCE PARTIALLY VERIFIED — NOT LEGAL DRIVING APPROVAL  
**Test case:** `KL-OWNER-URBAN-01` (sanitized public-road case; private route coordinates intentionally omitted)  
**Updated:** 13 November 2026 (MYT)

## Confirmed pilot behaviour
- Owner's stationary iPhone test: private KL graph pilot rendered a **3.19 km** route and **6.4-minute illustrative ETA** with **6 access-caution directed edges**, **0 candidate turn warnings** and explicit **`Legal driving route verified: NO`**.
- User re-entered the public test start as numeric coordinates in Google Maps, reported an unchanged **3.2 km / 8 min** driving route and accepted the displayed **~10 m / 0.31%** distance difference. **DISTANCE COMPARISON: PASS only**. The itineraries have not been independently proven geometrically identical.
- All six access flags come from *two* named OSM ways. Every flag is `access=destination`, which generally distinguishes local destination trips from through traffic (not universal vehicle access).

## Audited imported graph chain (read-only Atlas)
Source: `jalan_navigation.road_graph_edges_v495` and `road_network_v493`, existing Atlas cluster, no writes.

| Public OSM way ID | Imported name | Directed segments flagged | Approx flagged edge length | Metadata |
|---|---|---:|---:|---|
| 764105735 | Jalan Mahkamah Persekutuan | five, indexes 0–4 forward | 75.5 m | `access=destination`; `oneway=yes`; `highway=unclassified` |
| 624432328 | Jalan Mahkamah Tinggi | one, index 0 forward | 4.3 m | `access=destination`; `oneway=yes`; `highway=unclassified` |

- The six flagged segments are consecutive and directed **forward**. The first connects at imported OSM node `5892341140` from `Leboh Pasar Besar` (imported OSM way `557233421`, **one-way forward**); the last flagged segment ends at `11598068344`. The two restricted ways join at imported node `7138559868`.
- The segment-length sum is **~79.8 m**, calculated from imported straight-line segment endpoints; **not** surveyed roadway length. Six flagged segments do not imply six different streets or six confirmed illegal entries.
- Imported `road_network_v493` shows an onward forward segment on Jalan Mahkamah Tinggi; selected route did not report it as a flagged segment. This confirms the edge identities given by the owner, not the full end-to-end route geometry.
- External OSM-derived listings show the same two street names, connected streets, one-way direction and `access=destination` tags. See references below. **Current on-street signs and actual motor-vehicle permission have not been inspected.**

## Destination snap boundary check (read-only)
- Independent read-only Atlas bbox screening of **28** public mapped-road ways near the user's declared test destination; shortest point-to-segment distances computed locally using approximate latitude/longitude projection.
- Closest candidate: the destination-only **Jalan Mahkamah Tinggi / Jalan Mahkamah Persekutuan** junction, **~33.4 m** from test destination.
- Closest candidate *without this imported access caution*: an unnamed `highway=service` way `627743415`, **~53.7 m** away; next unnamed service way `1323547305` ~54.3 m; **Jalan Benteng** (way `627743416`, `highway=service`, one-way) **~69.4 m** away.
- Nearby unflagged road **does not imply public motor-vehicle access**; the imported map is incomplete as proof of signage/barriers, and a more distant snapped edge is not necessarily reachable in the required direction. These are candidates for further review, not approved alternatives.
- **Important risk:** nearest-road snapping alone can select a destination-only carriageway even though the user-supplied destination point is **not on that carriageway**. A nearby destination does not establish the user's legal entitlement to access the restricted road or that the road is the correct vehicle arrival/drop-off point.

## Review status and decision
| Check | Status |
|---|---|
| Owner-defined displayed distance tolerance | **PASS** |
| Six warning edge identities and imported OSM access categories | **VERIFIED** |
| Continuity of six directed warning edges / imported one-way chain | **VERIFIED IN GRAPH** |
| External OSM-derived agreement on tagged ways | **CORROBORATED**, not physical signage |
| Actual destination is legitimately served by destination-only restricted zone | **UNVERIFIED** |
| Public accessible alternative vehicle arrival/snap | **UNVERIFIED** |
| Google/TomTom full route path, junction and current legal access | **UNVERIFIED** |
| Legal vehicle directions / production route approval | **NOT APPROVED** |

**Engineering decision:** Do not clear the six warnings or change `access=destination` to unrestricted. Do not certify the current route as safe or legal. Keep TomTom authoritative for live routes. For a future *experimental* candidate, compare destination-aware restricted access versus a separately calculated, accessible public-road arrival point; require an actual eligibility rule, directed connectivity, barriers/road-sign evidence, and owner-visible uncertainty before allowing any routing change.

## Full imported KL graph comparison — 13 November 2026

Read-only trusted GitHub Actions experiments used **all 168,221 imported directed KL road edges** and public OSM-road fixture endpoints. **These public fixtures are NOT the owner's complete 3.19 km origin/destination** and do not constitute the 20 independently reviewed driving journeys.

| Test / evidence | Original restricted approach | Experimental unflagged arrival |
|---|---:|---:|
| Approximate public-OSM driving distance from local fixture start | **87 m** | **10 m** (selected candidate) |
| `access=destination` caution edges traversed | **6** | **0** (on selected candidate path) |
| Selected public directed OSM edge | Restricted two-way sequence | `osm-way-784531130:1:F` |
| Nearest straight-line last leg to fixture destination | N/A | **78.9 m** |
| Directed imported graph reachable | Yes | **Yes** |
| Verified vehicle stopping permission | No | **No** |
| Verified walking connection, barriers or crossings | No | **No** |
| Actual driving/legal route approved | **NO** | **NO** |

**First comparison** [Actions 43453353742](https://github.com/Zux12/Mterms2026/actions/runs/43453353742) reviewed eight closest directed candidate edges, all on disconnected service roads `osm-way-1323547305` and `osm-way-1323547306`, at **34.7–42 m straight line** from the public fixture endpoint. **None** was directed-reachable after caution edges were excluded. This demonstrates that the nearest road is not necessarily a valid driving arrival.

**Improved distinct-way comparison** [Actions 43454600352](https://github.com/Zux12/Mterms2026/actions/runs/43454600352) bounded the search to 16 candidate directed edges, maximum two per OSM way, within 150m straight line. Nine candidates are directed-reachable without caution edges, seven are disconnected. Selected candidate `osm-way-784531130:1:F` is **Leboh Pasar Besar**, imported `highway=tertiary`, `oneway=yes` forward, `surface=asphalt`, no explicit `access`, `vehicle` or `motorVehicle` restriction. **Absence of a caution tag does not prove stopping or local access is permitted.**

The selected candidate's **10m driving + 78.9m straight-line final leg** is **not** a verified alternative driving+walking itinerary; an actual pedestrian path can be longer, blocked or unavailable. Roadside stop restrictions, signage, pedestrian crossings and the destination boundary remain unverified. The two comparisons are controlled graph experiments, not proofs of legal driving directions, and not production JALAN routing changes.

**Engineering conclusion:** Finding a directed-reachable, less-restricted public OSM arrival is feasible *in this imported graph* near the sampled restricted approach. Do **not** automatically snap user destinations to it or clear the six warnings. Next independently verify safe vehicle stopping, pedestrian accessibility, destination-only permission, and real route geometry against a current authorized road routing provider. Turn-aware enforcement is **not** authorized: full graph turn-readiness audit reports zero verified-simple restrictions and 1,941 total relation records.

## Independent newer Medan Pasar access evidence — 14 November 2026

**New source relevant to this same street area**: [The Star, 12 October 2026, “Medan Pasar redesign draws mixed reactions”](https://www.thestar.com.my/metro/metro-news/2026/10/12/medan-pasar-redesign-draws-mixed-reactions) quotes **DBKL's stated design**, not a post-completion road inspection: (1) permanent bollards around the historic clock tower to exclude vehicles from pedestrian areas, (2) removable bollards in the south zone, (3) a raised pedestrian space between the clock tower and Lebuh Pasar Besar, and (4) exception for **business-related loading/unloading access** using the fire appliance access road. DBKL indicated such access could remain despite pedestrian priority; the report explicitly says exact operational management had not been supplied. The stated expected completion was **22 October 2026**; actual bollard installation and entry position as of 14 November are not independently confirmed.

**Supporting observed place activation, not vehicle clearance**: [The Star, 3 November 2026, “Discover a confluence of people, ideas and art at Muara Arts Gallery”](https://www.thestar.com.my/lifestyle/culture/2026/11/03/discover-a-confluence-of-people-ideas-and-art-at-muara-arts-gallery) reports the gallery actually opened on **1 November** at **18 Medan Pasar**, confirming an active pedestrian visitor destination. It describes public transport access; does not locate current bollards or authorize private-car entry to the square.

**Routing safety implication:** This is more informative than static untagged `Leboh Pasar Besar` edges near the public test endpoint, but neither article provides a precise OSM-node-to-bollard polygon, updated turn regulation, real-time stopping rule, or current TomTom journey. **Do not infer that all of Leboh Pasar Besar is closed**, that the original six `access=destination` segments are illegally traversed, or that `osm-way-784531130:1:F` is an approved roadside arrival. Treat its previously observed **10 m graph drive + 78.9 m straight-line final leg** as an *advisory candidate only*. For any future pilot: distinguish vehicle-access zone, loading/authorized access, emergency route, pedestrian-only area, legitimate curbside drop-off and an actual connected walk. Driver instructions must not send ordinary cars across a bollard regardless of the graph's connectivity.

**Status:** NEW EXTERNAL DESIGN EVIDENCE (DBKL statement via local press) — **NOT** road-level legal permission, current physical barrier position, a live TomTom comparison, or an accepted 20-journey case. Before route acceptance, get exact current georeferenced bollard/signage evidence and safe drop-off from DBKL or verified current street-level survey; independently map onto directed OSM ways without inventing restrictions.

## Next acceptance actions
1. Verify on-street/authoritative local signage or current road restrictions at entry from Leboh Pasar Besar and at the Junction of Jalan Mahkamah Persekutuan / Jalan Mahkamah Tinggi; a tagged OSM way is not a road permit.
2. Establish whether the requested destination is **inside the legitimately served access-only area**, or requires a nearby public road drop-off and short final walking distance. Use only consenting, non-sensitive public test points.
3. Calculate *advisory-only* alternate road arrival with restricted edges excluded **in a test fixture/isolated preview**, never by modifying live TomTom or the production route engine. Confirm directed reachability and one-way semantics.
4. Compare full geometry and turn-by-turn route with a current independently authorized routing provider; do not equate similar total distances with matching legal paths.
5. Only after independent road-level review could this become one of the 20 accepted real KL journey cases; accepted **distance-only** is not accepted **road legality**.

## References
- OpenStreetMap [access=destination](https://wiki.openstreetmap.org/wiki/Tag:access%3Ddestination) semantics; tag is advisory mapping evidence, not an authority issuing permission.
- OSM-derived [Jalan Mahkamah Persekutuan](https://malaysia-streets.openalfa.com/streets/jalan-mahkamah-persekutuan-kuala-lumpur-malaysia) and [Jalan Mahkamah Tinggi](https://malaysia-streets.openalfa.com/streets/jalan-mahkamah-tinggi-kuala-lumpur-malaysia) listings.
- OSM public identifiers: [way 764105735](https://www.openstreetmap.org/way/764105735) and [way 624432328](https://www.openstreetmap.org/way/624432328).
- The internal project acceptance checklist remains `server/jalan/KL_REAL_ROUTE_ACCEPTANCE_RUNBOOK.md`. No raw GPS history, credentials or coordinates are recorded in this report.
