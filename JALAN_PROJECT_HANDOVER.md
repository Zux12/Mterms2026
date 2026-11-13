# PROJECT JALAN — MASTER HANDOVER & ENGINEERING LOG

**READ THIS FILE FIRST IN EVERY NEW CHAT OR AUTOMATED DEVELOPMENT RUN.**
**Updated:** 2026-11-13 (Malaysia time, UTC+08)
**Owner's priority:** Get an operational, reliable JALAN web navigation app into the owner's hands for testing, then prepare distribution and later Apple App Store work. Avoid repeating completed work.

## 1. Current position (do not accidentally reset progress)

- **Latest previously reported overall engineering progress: ~93% (estimate, not an audited readiness measure).** Earlier milestones in Project JALAN conversations were 88% -> 90% -> 92% -> 93% on 12–13 Nov 2026. **Do not substitute a lower estimate based only on the routing PRs.** Do not increase the figure without additional demonstrated deliverables and clear rationale.
- **Production/release readiness is NOT 93% verified.** Real-road legality, integration, journey validation, and production-grade navigation need acceptance.
- **Newest routing development checkpoint at writing: draft PR #33**, head `852f991e20275b0229c76b9aac694a0efd9b8383`, based on draft PR #32. GitHub Actions run `43383992182` completed **success**; the full-KL credentialed graph job was **skipped** on the draft PR, not passed.
- Recent routing fixes are **stacked draft PRs** (especially #24–#33), *not merged/deployed*. Do not reproduce the same safeguards or claim draft code is in production.
- **Last handover operation:** creation of THIS documentation file; no navigation runtime changes or deploy during handover.

## 2. Repositories, services, and links

- **Frontend / GitHub Pages prototype:** https://github.com/Zux12/jalan-navigation ; https://zux12.github.io/jalan-navigation/
- **Backend/shared app repository:** https://github.com/Zux12/Mterms2026 ; main holds original application and isolated `server/jalan/` diagnostic integrations.
- **Experimental backend routing PR #33:** https://github.com/Zux12/Mterms2026/pull/33
- **PR #33 passed CI:** https://github.com/Zux12/Mterms2026/actions/runs/43383992182
- **Earlier private KL pilot URL recorded in project conversations:** https://jalan-kl-private-pilot-5ac59f8ae0bd.herokuapp.com . Historical discussion reported successful authenticated deployment and visible route/navigation UI at ~90–93%. **Current uptime, configuration, and deployment revision NOT independently rechecked in this handover. VERIFY before claiming live or changing it.**
- **Hosting decision:** Heroku for the backend/pilot, NOT Railway. The user specifically chose existing Heroku/Mterms integration, while prior conversations also report a separately isolated private KL pilot. Reconcile actual current Heroku app inventory before changing any service; do not provision a new paid service without need.
- **MongoDB:** existing shared infrastructure with isolated database `jalan_navigation` and `/api/jalan` endpoint (previously observed); do not touch unrelated data. Never record secrets in this file.
- **Traffic/routing:** TomTom live routing/ETA/traffic is the existing practical provider; OSRM fallback, Waze comparison by external deep link. No Waze partner feed/API is available. Experimental KL OSM turn-aware router is *advisory only*, NOT the production authority.

## 3. Scope and constraints — nonnegotiable

1. **Coverage:** Full **Peninsular Malaysia FIRST**. Kuala Lumpur is an initial pilot, not final coverage. Sabah and Sarawak only after Peninsular works well.
2. **Protect original Mterms2026 app/files, health and data.** Do not disrupt unrelated oilandgas/other services using the shared app. User previously allowed brief Heroku downtime during necessary deploys but prefers safe, targeted changes.
3. Keep unverified changes on isolated dev branches/draft PRs; **no automatic merge or deployment** of unverified experimental routing. Do not expose credentials. No MongoDB writes except deliberately planned, isolated, approved service operation.
4. Reuse existing code and verified CI results. **Avoid test-for-test's-sake, redundant PRs and repetitious rework**. Prioritize usable app integration, route accuracy and real-world acceptance. Run targeted tests for changes and only relevant full suites.
5. Work autonomously within these safety bounds; user does not want repeated 'go' requests. Ask only for genuinely required external access or decisions.
6. Never claim offline test success establishes real-world turn legality or deployed production behavior.
7. This file is the **handover source of truth for project coordination**, but verify time-sensitive status against live GitHub/Heroku evidence. Update after each meaningful change/verification, even if no code changed.

## 4. Implemented / previously recorded milestones (do not repeat)

- Frontend prototypes progressed V2.x -> V3.x -> V4.x: auto GPS; route drawing & ETA; route instructions and voice; real-GPS navigation; rerouting; traffic checks; trip logs/CSV; GPS-jump smoothing and map matching; road inspector; smart crowdsourced multi-driver congestion confirmation; responsive/mobile UI.
- TomTom routing/live traffic, OSRM fallback, Waze ETA/deep-link comparison; no direct Waze real-time partner feed.
- Earlier local/prototype UI with speed, journey telemetry, incidents, voice, dashboard and fit-to-route.
- Shared Heroku/Mterms-backed JALAN diagnostics were merged into Mterms2026 main around 10 Nov 2026; read-only/experimental diagnostics and auth regression tests were reported working.
- ~88% historical checkpoint: browser/Chromium validation and authenticated read-only KL graph work, with previously reported graph of **168,221 edges**. This is historical report, NOT blanket proof of travel legality.
- ~90% historical checkpoint: separate private Heroku KL pilot reported deployed with an authenticated route.
- ~92% historical checkpoint: pilot displayed its calculated route on the map.
- ~93% historical checkpoint: GPS/location controls, navigation-style dashboard, mobile controls and fit-route improvement reported done.
- As of Nov 13: staged KL directed-road/turn-safety fixes through PR #33: canonical graph IDs, verified via nodes/ways, unsupported turn rule handling, U-turn safeguards, duplicate edge identities, missing endpoints, unique restriction evidence, explicit fail-closed turn-enforcement flag. CI run #43383992182 passed. Full-KL credentialed graph job was SKIPPED under trust protections.

## 5. Outstanding acceptance gates and correct NEXT actions

**Do next, in this order; check whether already completed before doing anything:**
A. **Inspect live current state**: fetch this handover; check latest frontend/backend commits, all open PR heads and CI; check existing Heroku pilot URL and actual running configuration if authorized connector access is available. Determine which frontend/backend version is *really deployed*, not just in draft PR. Preserve original Mterms.
B. **Reconcile staged drafts before further router micro-fixes**: trace ancestry and overlapping security PRs, produce a minimal integration plan; avoid unnecessary new overlapping PR chains. Do not merge unverified changes.
C. **Authenticated, read-only full-KL graph and road-restriction evidence validation** on trusted environment where credentials exist. The PR-only `kl-fullgraph` skip is NOT a failure and NOT a pass. Do not copy secrets into PR workflows.
D. **At least 20 independent representative KL real-road route reviews**, including legal turns, grade separation, one-way/access constraints, GPS snapping, actual routing behavior vs TomTom, realistic ETA/reroutes. Document pass/fail and route provenance. Do not mark complete without evidence.
E. **Validate private Heroku web pilot in browser/mobile**, including location permissions, actual position, turn guidance, traffic/reroute, error handling, mobile controls and trustworthy ETA; resolve any issues. Owner wants to test the web app personally. No invented test outcomes.
F. **Expand Peninsular coverage/reliability** after KL acceptance, protect data privacy/opt-in crowdsourcing, and only subsequently plan East Malaysia.
G. When stable, prepare Apple developer/App Store packaging considerations, tests and promotion; this is later, not the next coding task.

**The immediate priority is integration and actual deployed pilot/road validation, NOT yet another tiny offline safety patch.**

## 6. Scheduled automation (already exists — DO NOT DUPLICATE)

- Title: **Continue JALAN development**
- Task ID: `Automation_58b16b1f255481919896294bf0c8d181`
- Schedule: **hourly**, timezone **Asia/Kuala_Lumpur**; last checked enabled on 13 Nov 2026.
- It can work on isolated GitHub branches, draft PRs and CI. It must follow the same safety instructions and **READ + UPDATE THIS FILE each run if meaningful activity occurs**. If no activity, report no change rather than fabricating a commit.
- Do not mistake the existence of scheduled task for proof it successfully deployed or ran tests. Inspect actual run/CI details.

## 7. Operating rules for future assistants / automation

1. Start by reading `JALAN_PROJECT_HANDOVER.md` from **`Zux12/Mterms2026` main**, plus current PRs/Actions and latest commits of BOTH repositories.
2. If source says a task already done, don't redo it merely because another chat lacks context. Verify only what is needed to establish current state.
3. Before work, write down the precise missing milestone and success criteria. Prioritize unlocking real-road and web-app usability.
4. After **each meaningful action** update the 'Latest activity' and add a dated activity-log entry (Malaysia local date/time when known): what changed, repo/branch/commit/PR, tests and links, what was not tested/deployed, next action/blockers. Update this document with `fetch_file` + `update_file` using current blob SHA; never overwrite concurrent changes or edit unrelated code.
5. For solely documentation updates, main is acceptable; for code, use isolated branch/draft PR unless a verified, explicitly suitable deployment process is established.
6. Keep short but information-rich, append new log entries newest first, preserve prior important milestones. Keep all credentials out of GitHub.

## 8. Latest activity / chronological log (newest first)

### 2026-11-13 — Master handover documentation
- Created repository handover to solve cross-chat continuity and prevent repeating previously completed stages.
- Confirmed from GitHub: backend PR #33 still the most recently updated open JALAN PR at this point, head `852f991e20275b0229c76b9aac694a0efd9b8383`; CI run `43383992182` completed success.
- Confirmed frontend repo `Zux12/jalan-navigation` exists, `main` latest commit observed `42724ae699fa730f5db86e6f0b5effbe84f23c7f` (2026-11-08 17:13:04 UTC); do not confuse this with later private Heroku pilot development.
- Confirmed hourly automation `Automation_58b16b1f255481919896294bf0c8d181` is enabled, and UPDATED its prompt to read and maintain this file on meaningful runs (next scheduled 16:00 MYT at time of update).
- No code, Heroku deployment or MongoDB data touched by this handover update.
- Next: validate actual current Heroku private pilot/deployed revision; reconcile stacked PRs; obtain full-KL/20-journey acceptance evidence.

### 2026-11-13 — PR #33 (previous development session)
- Added explicit `turnRestrictionsEnforced:false` on denied turn-verification readiness and one regression test, in two `server/jalan/` files only.
- Draft PR: https://github.com/Zux12/Mterms2026/pull/33
- CI: https://github.com/Zux12/Mterms2026/actions/runs/43383992182 **SUCCESS**; authenticated `kl-fullgraph` was SKIPPED. No merge/deploy or prod changes.

### 2026-11-12–13 — Earlier recorded milestones
- 88% -> 90% -> 92% -> 93% engineering estimate reported in project conversations (historical reporting; current live availability not reverified).
- KL directed-road experimental safeguards developed through staged PRs #24–#32, with individually successful offline CI; protected full-KL jobs skipped on draft PRs.
- Real-world 20-trip acceptance and Peninsular-wide verification remain outstanding.

---

**FOR A NEW CHAT, USER CAN SAY:** "Read `JALAN_PROJECT_HANDOVER.md` in `Zux12/Mterms2026` on main, inspect latest GitHub/Heroku and hourly JALAN automation, then continue from the listed NEXT actions without repeating completed work; update the handover after every meaningful action."
