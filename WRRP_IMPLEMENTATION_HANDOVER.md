# WRRP Implementation Handover — 2026-11-16

## Scope and user authorization
User approved implementing the Weekly Research Recognition Programme at oilandgas.eu.com, with one hard exception: **DO NOT enable congratulatory author emails** until all testing is complete and the user explicitly decides to activate sending.

## Current implementation
Backend repository: Zux12/Mterms2026
- server/oilandgas/recognition.js — independent public and authenticated editor routers; provisional deterministic 100-point metadata ranking; Monday 09:00 MYT weekly cycle computation; verified-Malaysian-affiliation tie-break using private contact collection; editor preview; staged overrides and audit; transactional manual activation; public active/archive/search; certificate issuance and certificate verification.
- server/app.js — public recognition mount.
- server/oilandgas/editor.js — editor-authenticated recognition API mount and static recognition admin page.
- server/oilandgas/desk/recognition.html — dashboard for preview, override, weekly activation, certificate issuance, notification placeholder.
- server/oilandgas/desk/desk.html — link to new admin workspace.
- tests/oilandgas-recognition.test.js — offline smoke assertions for dates, scores, no email transport.

Frontend repository: Zux12/oilandgas-website
- index.html — separate recognition homepage section and navigation, without replacing existing homepage highlights or weekly picks.
- recognition.html — current selections and public archive with title/author/category search.
- certificate.html — unique public certificate verification and print-to-PDF view.

## Safety locks
- NO author email transport in recognition.js: no nodemailer imports, no sendMail or createTransport calls.
- Public and editor notification states always report emailEnabled=false.
- The automatic scheduler only runs if environment variable OIL_RECOGNITION_AUTO is exactly true. Default is disabled. Do NOT set that variable until pilot selection checks are complete.
- Existing membership and article receipt emails are separate workflows and have not been modified.
- Recognition records are stored in separate MongoDB collections. Existing homepage selection records are not overwritten.
- Preview and override staging do NOT activate/publicize selected papers.
- Manual activate endpoint requires an authenticated editor and the confirmation string ACTIVATE_NO_EMAIL.
- Certificate issuance is authenticated and requires exact byline match; it produces no email.

## Current limitations (must resolve before turning automatic weekly programme on)
1. AI technical-quality scoring is NOT implemented. The current 100-point ranker is explicitly labelled rule-based/provisional and uses publication metadata/keywords; do not advertise it as a scientific AI assessment.
2. Publication retraction checks and external bibliographic evidence validation are not implemented.
3. Co-author identity parsing depends on exact comma/semicolon byline. Handle ambiguous names and verified affiliations before bulk certificate issuance.
4. Certificates are browser-printable HTML with Save as PDF; server-generated downloadable PDF documents are not yet implemented.
5. Author email permission checks, suppression lists, resend mechanisms and actual email delivery are intentionally NOT implemented. Keep this a placeholder until user authorizes.
6. The weekly scheduler is process-local 15-minute polling with a disabled feature flag; production scheduler precision / deploy behavior and distributed job locking need testing.
7. No confirmed live Heroku or GitHub Pages deployment smoke tests yet. External HTTP lookups failed from the current environment.
8. No comprehensive tests have executed against MongoDB or live website. JS source parses successfully with V8 Function() syntax checks, but this is not a test of runtime behavior.
9. The Malaysian affiliation tie-break is conservative and only uses existing private author records, not summaries. Confirm its correctness against actual author identifiers.
10. Archive is public and searchable, but award issuance and SEO metadata need end-to-end validation.

## Required next testing sequence
1. Check Heroku deployment state for latest backend main commit.
2. Verify GET /api/oilandgas/recognition/current returns 200 without recognition data exposing private emails.
3. Sign in to Editor's Desk; confirm admin status/preview/overrides/history/notifications endpoints and CORS.
4. Execute node --test tests/oilandgas-recognition.test.js in a properly installed Node environment.
5. Use test-only selection runs and inspect selected title, author, source, evidence, category uniqueness, and Malaysian tie-break.
6. Validate manual override and transaction/idempotency with a test collection or staging environment, not production first.
7. Validate certificate issue/verify/print, including duplicate handling, invalid author, withdrawn cert, and privacy.
8. Validate public archive paging, category/title/author filtering, mobile view, and homepage fallbacks.
9. Implement strong AI scoring/evidence review and correct full-text validity checks.
10. Only after successful pilot, consider activating weekly scheduling. **Email sending still remains off** until user separately approves.

## IMPORTANT
Do not misstate completion: current work is a committed foundation undergoing tests, not a completed, production-validated programme.

## Continued engineering — 16 November 2026 (subsequent go)
- Audited live MongoDB oilandgas.publications: 124 published publication records; all 124 have HTTPS source URLs and publication IDs (this does NOT prove links resolve or that manuscripts are non-retracted).
- Verified there are no recognition collections in the live database at the time of audit. No programme recognitions activated and no certificates sent.
- Added server/oilandgas/recognition-policy.js: strict publication-only selection, source URL requirement, integrity-status hold, byline token matching, and category threshold rules.
- Updated recognition.js to shortlist source-backed published research publications only, reject ineligible manual overrides, and enforce score thresholds (85 Editor's Pick, 75 other categories) unless explicitly overridden by an editor. Metadata text scoring remains provisional and not a validated scientific-quality review.
- Added a second independent activation guard: OIL_RECOGNITION_ACTIVATION_ENABLED must be exactly 'true' to activate selections, whether manually or by scheduler. Leave this OFF during testing. OIL_RECOGNITION_AUTO remains OFF.
- Staged editor overrides now appear in the preview (same code path as activation).
- Added admin-only /recognition/withdraw for an invalid recognition; auditable transactional withdrawal revokes linked certificates. Added withdrawal controls in Editor's Desk recognition page.
- Added tests/oilandgas-recognition-policy.test.js and extended .github/workflows/recognition-tests.yml to check eligibility, integrity holds, co-author matching, thresholds, activation guard, and absence of mail transport.
- Checked JavaScript syntax of prior committed source using V8 JS parsing; after changes, fresh runtime checks and GitHub Actions result still require confirmation.
- Live web and Heroku smoke checks are NOT confirmed: public HTTP retrieval via available web/container connection failed. GitHub commit success does not prove Heroku deployment.

### Important current safety status
Recognition author emails: OFF, placeholder only. Existing membership/submission receipt flows remain unchanged.
Recognition activation: **LOCKED** unless an operator explicitly configures OIL_RECOGNITION_ACTIVATION_ENABLED=true. Do not set this flag until end-to-end tests pass.
Automatic weekly scheduler: OFF by default.
Cert issuance: available as an authenticated manual workflow only for a selected verified byline name; no emails generated.

### Remaining gaps
1. Independent evidence-backed, credible AI evaluation (not just keyword scoring) and publication retraction/withdrawal verification against authoritative sources.
2. Verify GitHub Actions executed successfully, then live Heroku deployment and public-site functionality.
3. End-to-end integration tests, including admin session, DB transactions, duplicate requests and override exclusion.
4. Validate names for all co-authors and generate PDF/signed recognition packages beyond browser print view.
5. Build notification preference and suppression workflows as placeholders only. Do not connect email provider until explicit user approval.
6. Review scoring fairness and 12-week author cooldown, plus topic/institution diversity.
