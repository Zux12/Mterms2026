# WRRP-001 — Transparent Keyword Assessment and Fairness Standard

Status: **Proposed scoring-methodology specification / not authorization for production activation**  
Date: 18 November 2026  
Programme: Oil & Gas — Knowledge • Expertise • Exchange

## Purpose and bounded claims
The Weekly Research Recognition Programme uses a **deterministic, rule-based editorial screening score**, not AI, machine learning, scientific peer review or independent verification of an author’s experimental findings. Its goal is to consistently identify and compare **documented indicators** of relevance and potential contribution to oil and gas practice across a verified pool of research publications.

Keyword evidence is **not proof** that an article demonstrates originality, practical deployment, or sound scientific methodology. The final public programme should say "editorial research recognition" rather than "scientifically validated award."

## Current implemented score (audit of server/oilandgas/recognition.js)
The current `scorePaper` reads `title + summary + topic`, using five regular-expression families plus whether a source URL is present. Its score is **provisional**, with all-or-nothing scoring on most criteria:

| Criterion | Maximum | Current implementation | Interpretation and limitation |
|---|---:|---|---|
| Industry relevance | 25 | Regex matching oil, gas, petroleum, refining, pipeline, drilling, offshore, LNG, process, energy, carbon, emissions, corrosion, metering, measurement, reservoir, safety | Text matches topical language; doesn't prove applicability |
| Technical contribution | 20 | Regex matching method, analysis, model, experiment, data, measurement, evaluation, simulation, comparison, investigation, result | Signals a method/result is described; not its validity |
| Practical applicability | 20 | Regex matching case study, field, deployment, plant, industrial, operation, implementation, prototype, validation, performance, optimization, reliability, experiment | Signals applied context; does not prove actual deployment |
| Evidence and credibility | 15 | Source URL present = 15; absent = 8 | URL presence is not sufficient evidence of scientific strength and must not remain the sole credibility measure |
| Originality | 10 | Regex matching novel, new, innovative, advanced, improved, framework, approach, development, design | Self-descriptive terms, not independent novelty verification |
| Timeliness & community value | 10 | Regex matching safety, risk, reliability, efficiency, cost, emissions, sustainability, environment, maintenance, integrity, performance | Topic value, not recency or measured impact |

Current threshold: Editor's Pick 85/100; Industry Impact and Emerging Research 75/100.

## Fairness safeguards REQUIRED before production
1. **Comparable inputs:** Obtain the authoritative original abstract for each publication when possible. Current database audit: 124 published papers; 121 summaries under 250 characters; average summary length ~143 characters. Short directory summaries are NOT equivalent to abstracts. Mark unavailable/insufficient abstracts `assessment-pending` and provide a way to correct their source content; do not penalize a paper with a zero score merely because the abstract is missing.
2. **Same rubric and version:** All competing candidates in a given selection cycle must use the identical rule set, keyword dictionary, weighting, document-field mapping and rubric version.
3. **Explain every point:** Capture which terms and passages matched for each criterion, which points were awarded, which evidence was independently source-confirmed, and what cannot be inferred. Avoid opaque binary "AI quality" claims.
4. **Whole-word/context safeguards:** Normalize case and punctuation and use phrase/word boundaries so incidental substrings do not earn points. Review negated statements ("not validated"), generic boilerplate and duplicate terms to avoid over-crediting them.
5. **Balanced partial evidence:** Do not let one claimed adjective, one keyword, or the mere presence of a URL generate the maximum technical, novelty, applicability or evidence score. Proposed improvement: documented graded subcriteria under the same six 100-point weights, with capped points and traceable reasons.
6. **Topic neutrality:** Apply a tested dictionary covering refinery, upstream, midstream, petrochemicals, measurement, safety, environmental, digital systems and cross-industry methods; no unfair preference for longer abstracts, more fashionable terminology, particular universities or author seniority. The previously approved narrow Malaysian-affiliation tie preference must be explicitly disclosed, and only applied after meeting the same minimum evidence and quality thresholds.
7. **Source and integrity gate:** Verify genuine published status, DOI/original source/title/byline where possible; do not equate a URL with provenance or retraction clearance. Hold disputed/retracted/uncertain records pending review.
8. **Lifetime exclusion:** Previously recognized research cannot be selected again under another title/DOI/source. Admin override cannot bypass this rule or integrity holds.
9. **Human oversight and errors:** Show candidate scorecard and explanations privately before selection; allow documented evidence corrections and transparent editorial override, with an audit history.
10. **Dry-run fairness audit:** Compare all eligible papers and include a stratified sample across research topics, publication years, abstract lengths and Malaysian/non-Malaysian affiliations. Evaluate unsupported matches, missing evidence and the effect of rubric updates, before enabling Friday/Monday automation.
11. **No arbitrary back-catalogue cutoff:** All existing eligible papers and future papers compete. Scores must not depend on submission date except where timeliness is explicitly substantiated and rubric-approved.
12. **No automatic winner if no qualified evidence:** Leave a category unfilled; never lower thresholds or fabricate an evaluation.

## Scoring disclosure for research authors (draft)
> The Oil & Gas Weekly Research Recognition Programme identifies eligible publications using a transparent, rules-based editorial score. The assessment considers industry relevance (25 points), described technical methodology (20), potential practical applicability (20), source and evidence indicators (15), reported originality (10), and relevance to current industry priorities (10). Scores are derived from the research abstract and verified publication metadata. Keyword and phrase matches are used as **signals**, not proof of scientific novelty, independent peer review or actual commercial impact. Publications that lack sufficient verifiable evidence are held for assessment rather than penalized for missing data. The programme records the basis of each assessment, verifies eligibility, prevents repeat recognition of the same paper and permits documented editorial review. A narrowly defined Malaysian-affiliation preference may apply when otherwise similarly scoring papers compete, without reducing eligibility standards.

## Engineering status
- The currently implemented keyword scorer is **a discovery-only provisional heuristic**, not yet a fair winner-selection engine.
- The reviewed-only automatic selector still depends on the old AI/full-paper path. Conversion to deterministic, abstract-first selection remains an engineering blocker.
- Do not activate automatic awards or author emails until graded rules, comparable inputs and evaluation tests are complete.
