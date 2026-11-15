# JALAN — independently sourced temporary road-control evidence (KL)

**Evidence captured:** 2026-11-15 (Malaysia time). **Status:** official road-control notices independently retrieved; route-engine, TomTom, signage, precise geometry, live state and 20-journey acceptance **NOT tested**. This advances N09 temporal-restriction review and supplies N10 case-preparation input, **not a routing deployment decision**. No user GPS, personal observations or credentials appear here.

## Primary authority records (publication and effective dates differ)

1. **DBKL, published 5 July 2026:** [Jalan U Thant pipe-jacking traffic management notice](https://www.dbkl.gov.my/berita-acara/penutupan-sementara-laluan-jalan-di-jalan-u-thant-bagi-kerja-kerja-pembinaan-pipe-jacking). **Stated restrictions: 6 July 2026 through 31 January 2027**, unless superseded. Direct exit Jalan U Thant → Jalan Tun Razak near Regal House **fully closed**; direct entry Jalan Tun Razak → Jalan Langgak Golf by Iraqi Embassy **fully closed**. Jalan Langgak Golf is designated **one-way outbound toward Jalan Tun Razak**. DBKL prescribes Jalan U Thant as the entry from Tun Razak into the local area, and Jalan Langgak Golf as the exit toward Tun Razak. The notice instructs compliance with on-site signs and traffic-management directions. This is authority-published **planned traffic control**, not as-built barrier coordinates or live confirmation that every sign is present.
2. **DBKL/KLCCC official site:** [KL-Seremban resurfacing traffic announcement](https://klccc.dbkl.gov.my/page/2/), alongside DBKL's [18 September 2026 lane-closure announcement](https://www.dbkl.gov.my/pengumuman/makluman-penutupan-lorong-lbr-kl-seremban-penutupan-lorong-secara-berperingkat). KLCCC reports works **8 September 2026–2 February 2027**, approximately **22:00–05:00**, both directions, from the SPE ramp toward the gateway near Plaza Dunia Perabot. This is **staged lane works**, **NOT** authority confirmation that the entire KL–Seremban corridor is closed. The DBKL announcement body has limited machine-readable detail; keep KLCCC as the source for operating window.
3. **LLM, published 15 September 2025:** [Jalan Johar–Jalan Beringin westbound reopening](https://www.llm.gov.my/announcement/announcement_detail/27337), said to open at 00:01 on 15 September 2025. This demonstrates that a historic closure must not be hardcoded indefinitely; **does not certify current November 2026 availability or access**.

## Cross-check against actual imported full-KL directed OSM graph — 15 November 2026 ~10:20 MYT

**New read-only technical evidence, NOT independent current road-ground-truth:** [JALAN backend PR #52](https://github.com/Zux12/Mterms2026/pull/52) merged three JALAN diagnostic/test/guarded-CI paths to isolated trusted source [`12bc05d8`](https://github.com/Zux12/Mterms2026/commit/12bc05d884b8f3432b4f883a90732d8d19aa13f2). Mock audit cases 2/2 PASS. [Protected realgraph CI 43666984616](https://github.com/Zux12/Mterms2026/actions/runs/43666984616) 7/7 SUCCESS with actual `jalan_readonly` Atlas metadata-only/read-only query, **168,221 directed KL edges** and no observed JALAN database writes or GPS reads.

| Imported public street name (exact case-insensitive match) | Imported OSM ways | Directed edge records | `oneway=true` ways | `oneway=false` ways | Public OSM node identifiers |
|---|---:|---:|---:|---:|---:|
| Jalan U Thant | 9 | 168 | 2 | 7 | 91 |
| Jalan Langgak Golf | 5 | 45 | 3 | 2 | 41 |
| Jalan Tun Razak | 211 | 573 | 211 | 0 | 582 |

One imported OSM node identifier is shared between U Thant and Tun Razak; one is shared between Langgak Golf and Tun Razak. These indicate **possible imported junctions only**. The audit did not independently retrieve current OSM tags, map the shared nodes to the specific DBKL-published Regal House/Iraqi Embassy restricted turn approaches, confirm sign or barrier positions, run an actual DBKL-temporal legal route, or compare live TomTom results. The 2026 temporary one-way plan **cannot be inferred from historic OSM one-way totals**, and no named-road subsegment can be declared open/closed on this evidence alone.

**Decision:** N06 still NOT APPROVED; N09 temporal control source + imported topological screening PARTIAL; N10 remains **0/20 independent complete KL driving journeys accepted**. No temporary rule imported into production, no TomTom substitution, no road restrictions enforced. Next: obtain current independent OSM/authority surveyed junction geometry and source-dated on-site controls, compare exact turn/grade-separated nodes with authorized real routes, and keep uncertainty explicitly visible.

## Eight candidate maneuver checks from actual notices — NOT eight accepted driving journeys

These are source-backed questions to be converted into complete independent origin/destination cases **only after** locating exact junction geometry and current on-site/updated authority evidence. They are not GPS fixes, route results or proof of legally navigable paths.

| Candidate | Category / maneuver to inspect | Grounded expectation during notice window | Critical independent follow-up |
|---|---|---|---|
| KL-TEMP-U01 | One-way/access: direct U Thant exit to Tun Razak by Regal House | DBKL reports exit closed | Locate exact slip/turn and signs; check no map route uses it |
| KL-TEMP-U02 | One-way/access: direct Tun Razak entry into Langgak Golf by Iraqi Embassy | DBKL reports entry closed | Confirm precise junction and any later change |
| KL-TEMP-U03 | One-way: Langgak Golf travel outbound toward Tun Razak | DBKL prescribes outbound direction, not general unrestricted access | Independently validate approach, permitted connection, signs |
| KL-TEMP-U04 | One-way: Langgak Golf inbound direction toward local area | Reverse direction conflicts with temporary one-way arrangement | Check up-to-date road control and any access exceptions |
| KL-TEMP-S01 | Short urban/alternative: Tun Razak → local U Thant area via Jalan U Thant entry | DBKL recommends this approach | Construct independently checked full O/D and exact turn sequence |
| KL-TEMP-S02 | Short urban/alternative: U Thant locality → Tun Razak via Langgak Golf exit | DBKL recommends this exit | Construct full O/D, check connectivity and legal stopping points |
| KL-TEMP-C01 | Corridor/night: KL–Seremban works segment at 23:00 MYT during stated window | Staged night-time **lane work** warning; no inferred full closure | Verify which lanes/directions are affected on that date via operator |
| KL-TEMP-C02 | Corridor/day: same works segment at 12:00 MYT | Night-only published schedule does **not** establish daytime closure or open state | Compare contemporaneous DBKL/TomTom notices; avoid permanent block |

Additional historical-status research candidate: **LLM–JB-WB-01** Jalan Johar–Jalan Beringin westbound was announced reopened 15 September 2025; verify 2026 authority state, exact geometry and travel eligibility before use as an actual case.

## Engineering implications and honest boundaries

- **N09 evidence advanced:** an official **direction-specific and date-bounded** one-way/closure source now exists, in addition to the already recorded staged KL–Seremban nighttime lane works. A time-independent imported OSM graph with no verified temporary restriction feed must **not** be treated as authoritative for these controls; keep TomTom production routing authority and the experimental legal-driving-verified flag false, turn enforcement OFF. Do **not** install static permanent bans based on 2026–27 notices.
- **N10 preparation advanced:** eight named, official-source-backed *maneuver-check candidates* are queued; **0 of 20 full, independently legally accepted KL driving journeys**. An individual maneuver is not an origin/destination journey. The already-existing five-class 20-case matrix, sanitized collector and acceptance runbook remain the governing test protocol: [KL real-route acceptance runbook](server/jalan/KL_REAL_ROUTE_ACCEPTANCE_RUNBOOK.md).
- **Source limitations:** official notice is not a surveyed geometry extract, real-time closure feed, as-built barrier inventory, approved vehicle stopping location or proof of downloaded OSM edge tags. Web access to six specific OSM node pages and OSM API was unavailable on 15 November. No direct TomTom request could be executed without a restricted owner key; no Heroku private route URL / authentication / fresh Atlas graph was exposed.
- **Safety:** Do not call a route disconnected solely because of a time-bound closure or the experimental router's 404. No driver dispatch, navigation instruction or fixed road ban is authorized by this document.

## Exact non-phone next step

Obtain an independently timestamped OSM way/node extract plus current authority/traffic operator detail for the *specific* U Thant/Regal House and Tun Razak/Langgak Golf turns. Construct public **road-level** start/end positions off sensitive/private property, run read-only fullgraph experimental routes (only on an authorized private endpoint), capture sanitized geometry/snap/distance evidence, and independently compare against current restricted-key TomTom routing. If current signs/closure extent cannot be verified remotely, mark **BLOCKED EXTERNAL** and leave route acceptance at 0/20. Do not replace any existing input with synthetic coordinates or silently unlock public KL3A/B/C GET controls.
