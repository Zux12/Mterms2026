# WRRP Directory-Only Scoring Fairness Review — 18 November 2026

**Status:** Read-only audit and targeted dictionary corrections; **NO award, threshold change, email, activation or production release**.

## Basis and scope
- Live source: connected `oilandgas.publications` database, 124 published records, using each record's exact existing `publication.title`, `publication.summary`, `publication.topic`, `publication.byline`, and `source`.
- Scorer: `server/oilandgas/recognition-rules.js`, deterministic `keyword-directory-v3.0`; 100 point fixed weights 25 relevance / 20 technical / 20 practical / 15 publication metadata traceability / 10 originality indicators / 10 industry priorities.
- Bibliography/source and integrity clearance are **separate qualification conditions**, not scientific-quality points. All scores below are **provisional editorial keyword results** and are not awards.
- Scoring treats existing short summaries equally; full abstracts were not retrieved, required or used.

## Revisions made following field-by-field audit
1. The generic phrase "oil and gas sector" previously matched both an upstream oil signal and a midstream gas signal, unfairly boosting scores for generic language. Now generic oil-and-gas sector language occupies one sector/priorities signal, and specialized upstream/midstream terms require actual technical wording.
2. "Process" in "analytic hierarchy process" was previously treated as refinery/downstream process language. The downstream dictionary now requires specific refining, processing, petrochemical, sludge or similar wording.
3. "First" in "which controls to address first" previously earned novelty credit. The novelty signal now requires explicit `first reported`, `first demonstration` or `first application` rather than ordinary order-of-operations language.
4. Plurals (sensors, measurements, meters, analyzers) and common forms of measurement terminology now match, avoiding arbitrary omissions in specialized disciplines.
5. Fixed 15 metadata points are explicitly not a scientific-evidence or peer-review judgment. They reward a source URL, named byline, descriptive title, and a summary/topic; each record gets the same audit treatment.

## Read-only score distribution **after** corrections
| Published category | Count | Mean score (rounded) | Max score |
|---|---:|---:|---:|
| Other | 53 | 39 | 69 |
| Reliability | 18 | 58 | 70 |
| Safety | 12 | 56 | 65 |
| Measurement | 11 | 53 | 61 |
| Instrumentation & Control | 10 | 63 | 75 |
| Energy transition | 10 | 57 | 71 |
| Digitalisation | 8 | 45 | 61 |
| Sensors | 2 | 46 | 46 |
| **Total** | **124** | | **75** |

- **≥85 (Research Editor's Pick): 0 papers**.
- **≥75 (Industry Impact or Emerging Research): 2 papers**.
- **≥70: 6 papers**.
- **≥65: 13 papers**.
- **≥60: 29 papers**.
- Scores and their exact keyword reasons depend on rubric code version and must be saved with any future recognition.

## Current highest-ranked candidates (not verified winners)
| Rank | Directory research title | Reference | Score |
|---|---|---|---:|
| 1= | Processing Capability Improvement Through Parameter Optimization of a Sludge Drying Plant | OG-P-463438DD9AA7645C | 75 |
| 1= | Parameter Optimization of a Sludge Drying Plant for Processing Capability Improvement | OG-P-CE060BA9E0C7BD8F | 75 |
| 3 | Energy Optimisation and Management System for Smart Buildings with IoT and Support Vector Regression-Based Predictive Modelling | OG-P-47A964319ED21BBF | 71 |
| 4= | Novel Approach of Tackling Wax Deposition Problems in Pipeline Using Enzymatic Degradation Process: Challenges and Potential Solutions | OG-P-1812BDAADA762B91 | 70 |
| 4= | Cost Effective Sludge Management Through Processing Capability Improvement of a Sludge Drying Plant | OG-P-56DE87CBBA73D667 | 70 |
| 4= | STRENGTH DEVELOPMENT OF EPOXY GROUTS FOR PIPELINE REHABILITATION | OG-P-MYCBC2EF58 | 70 |
| 7 | Implementation of Enterprise Risk Management (ERM) Framework in Enhancing Business Performances in Oil and Gas Sector | OG-P-7F6D82B8E1BE0561 | 69 |

### Editorial duplicate warning (not an automatic rejection)
The two 75-point sludge drying studies list the exact same four co-authors:
- M. Z. Mohamed
- M. F. M. Ghazali
- S. M. Idrus
- N. A. Wahab

They have closely related, reversed-word-order titles but **different source records** (IEEE proceedings DOI `10.1109/CCSII.2012.6470467` versus a UiTM-hosted IEEE colloquium paper `https://ir.uitm.edu.my/67105/1/67105.pdf`). They **may be distinct conference papers or overlapping versions**. Do **not** assume either identity from title similarity alone. An editor must inspect their contents and provenance before permitting separate lifetime recognitions.

## Threshold recommendation
**Do not silently lower the earlier approved thresholds of 85 / 75.** On the actual short-summary distribution, an 85-point Editor's Pick will remain vacant, which is acceptable under the user-approved "no qualified winner → vacant" rule. Both 75-point candidates require bibliography/integrity review and a related-publication check; they are not yet qualified awardees.

There is also a policy tradeoff: fixed 15-point metadata completeness applies to the entire collection, so scores reflect **editorial descriptions, not direct measured research merit**. For a programme intended to showcase research every week, a future openly disclosed recalibration or stronger standardized directory summaries may be appropriate, but not an unapproved threshold reduction or automatic score inflation.

## Validation and release safety
- New explicit regression tests for generic oil/gas double counting, plural sensors, incidental "first", and unrelated "process".
- **28/28 isolated source-evaluated tests passed** across rule engine, selector and weekly simulation. Full Node/GitHub CI and Heroku integration acceptance remain **unverified**.
- No recognition, award, letter, SMTP email, author outreach, activation switch or MongoDB write was performed by this audit.
