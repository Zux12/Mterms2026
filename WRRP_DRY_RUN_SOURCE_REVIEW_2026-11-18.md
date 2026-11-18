# WRRP — Recalibrated Shortlist & Source Review
**Date:** 18 November 2026 (MYT)  
**Run type:** Read-only controlled dry run, 70/60/60 minimums, `keyword-directory-v3.0`  
**Release:** Recognition OFF; author email OFF; no award issued

## Method
- Read 124 records from live `oilandgas.publications` with `status:published`. Read `recognition_selections`, `recognition_overrides`, `recognition_rule_reviews` and `recognition_controls`; all four had no records at time of check. No writes.
- Used exact GitHub `recognition-rules.js` and `recognition-selector.js` in a standalone isolated runner. `selector.choose(...,{verifiedOnly:false})` finds **provisional ranking only**, NOT production-eligible winners.
- Publication source confirmation used the independent original sources linked below. No real Crossref API, SMTP or production activation request was performed.
- Short summaries remain sole score text input (plus title and topic), with source/byline used for completeness.

## Provisional 3-category dry-run candidates
| Category | Minimum | Proposal and ID | Score | Source checking |
|---|---:|---|---:|---|
| Research Editor's Pick | 70 | Processing Capability Improvement Through Parameter Optimization of a Sludge Drying Plant — `OG-P-463438DD9AA7645C` | 75 | UiTM-hosted IEEE 2012 Shah Alam proceeding index lists exact title and 4-person byline. Full study content/identity comparison not completed. Source: https://ir.uitm.edu.my/id/eprint/67105/1/67105.pdf |
| Industry Impact | 60 | Cost Analysis Study Through Optimization of a Sludge Drying Plant for a Petroleum Refinery — `OG-P-00C378D8ACA439B7` | 68 | Original 2015 ARPN journal paper PDF confirms title, byline and abstract. Distinct work focus is cost/management, but study relationship to other sludge work needs review. Source: https://www.arpnjournals.org/jeas/research_papers/rp_2015/jeas_1015_2769.pdf |
| Emerging Research | 60 | Energy Optimisation and Management System for Smart Buildings with IoT and Support Vector Regression-Based Predictive Modelling — `OG-P-47A964319ED21BBF` | 71 | IEEE i-PACT 2025 conference programme and ORCID profile independently corroborate paper and authors. Direct oil/gas application is NOT established by directory summary; cross-industry applicability may require editorial rationale. Sources: https://vit.ac.in/ipact/assets/downloads/i-PACT2025-Technical-Session-Schedule.pdf and https://orcid.org/0000-0002-1468-2167 |

**Actual source-cleared production shortlist: zero**, since `recognition_rule_reviews` is empty. No administrator override or recognition history existed. A DOI alone or an accessible PDF is not independent integrity clearance.

## Related-publication risk — high priority
The following 2012 sources list the **same four authors** and near-identical title word sets:
- `OG-P-463438DD9AA7645C`: *Processing Capability Improvement Through Parameter Optimization of a Sludge Drying Plant* — 2012 IEEE Control and System Graduate Research Colloquium, UiTM Shah Alam, July 16–17, 2012, paper ID101, p. 388. Source: https://ir.uitm.edu.my/id/eprint/67105/1/67105.pdf
- `OG-P-CE060BA9E0C7BD8F`: *Parameter Optimization of a Sludge Drying Plant for Processing Capability Improvement* — 2012 IEEE Conference on Control, Systems & Industrial Informatics, Bandung, September 23–26, 2012, p. 26; DOI https://doi.org/10.1109/CCSII.2012.6470467. Conference table of contents source: https://www.proceedings.com/content/017/017350webtoc.pdf

Source evidence supports **two different proceedings listings**; it does not establish whether the full papers are identical, legitimate extensions or independent work. Do NOT merge, claim plagiarism, withdraw or automatically reject either on title/byline similarity.

Other high-scoring papers in the same sludge-drying research family include `OG-P-56DE87CBBA73D667` (70), `OG-P-02CBC4D32FEE890D` (60), `OG-P-E84D0780C5FE1B0D` (61), and the 2015 cost paper (68). Their content/methods may differ; same topic/team is not evidence of misconduct.

## Actionable editorial gates
1. Keep both top 2012 publications flagged **manual related-publication comparison** until someone examines the full original texts and determines whether their underlying experimental results and conclusions are genuinely distinct. This is a selection-quality caution, not an automatic rejection.
2. Review 2015 cost-analysis scope against the 2012/2015 sludge-drying family before recognizing the same underlying work in multiple categories or weeks.
3. Confirm source/title/byline and known-retraction notices for each individual candidate (especially the non-DOI UiTM and ARPN links); absence of a notice is not proof of scientific validity.
4. Document why a smart-building energy management paper qualifies for **Oil & Gas Emerging Research** as a cross-industry method, rather than asserting oil/gas field deployment.
5. Avoid issuing letters until authenticated source metadata identifies the correct individual coauthors.

## Engineering support added
- `server/oilandgas/recognition-related-review.js` provides conservative title+author overlap diagnostics; **not** a duplicate detector or misconduct determination.
- Authenticated read-only `GET /api/oilandgas/editor/recognition/related-review` and new *Related research screening* section on the Editor's Desk.
- Four isolated related-review regression tests passed; core backend and admin script syntax checks passed. Live Heroku/UI verification and full CI still outstanding.

**Nothing was activated, scored into a production recognition record, emailed or inserted into MongoDB by this dry run.**
