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

## Continued engineering — 16 November 2026 (evidence review phase)
- Added `server/oilandgas/recognition-review.js`: source URL/DOI extraction, Crossref metadata lookup (only DOI resolver hosts), conservative publication title matching, 100-point bounded AI assessment using the existing OpenAI JS dependency, and explicit limitations.
- The AI is **not** represented as having read the entire paper. Crossref agreement does NOT clear a paper of retraction risk. Output always includes `integrityCleared:false` and `readyForRecognition:false`.
- Added authenticated `POST /api/oilandgas/editor/recognition/review-paper`: reviews one existing published research reference, checks bibliographic mismatch, requires `OIL_RECOGNITION_OPENAI_API_KEY` (not configured by these commits), and never sends email or activates selections.
- Successful assessments are saved as draft-only `recognition_reviews` records with `pending-editorial-and-integrity-review` status; read-only `GET /api/oilandgas/editor/recognition/reviews` returns the latest drafts.
- Added manual evidence review UI within Editor's Desk recognition page.
- Added `tests/oilandgas-recognition-review.test.js` and GitHub Actions workflow test coverage for source matching, AI score limits, no-key fail-closed and no-email behavior.
- Ran **8 isolated in-memory runtime checks** of the fetched policy and review modules using mock URL/Crossref/OpenAI components: 8 passed. This is not a substitute for full Node CI, integration, or live Heroku tests.
- Attempted public page/API fetches from the available web access; inaccessible, so live deployment remains unverified. GitHub Actions full run status is not confirmed.
- No API key, Heroku config, scheduling, production recognition, certificate issuance, or email setting was changed.
- Next: run Node CI end-to-end, confirm Heroku deployment and admin login, verify actual DOI metadata on a small sample, add an independent retraction/integrity clearance workflow, then implement evidence-reviewed automatic shortlist. Keep activation and emails OFF throughout.

## Continued engineering — 16 November 2026 (reviewed-only weekly selection)
- Public Heroku and website HTTP checks were attempted using both web retrieval and the local execution environment. The endpoints could not be reached from those tools, so the production deployment remains unverified; do not treat GitHub commits as live deployment proof.
- Introduced `server/oilandgas/recognition-selector.js` as a pure verified-review selector with distinct publications per weekly category, 365-day publication cooldown, 84-day author cooldown preference, discouragement of repeat co-authors in a single week, category-weighted scores, and a narrow verified-Malaysian-affiliation preference when score separation is at most 5.
- `recognition.js` now has `GET /api/oilandgas/editor/recognition/preview-reviewed`: separate from the original *provisional keyword* preview, this selection gate requires approved evidence reviews, matching publication revision, bibliography verification, documented integrity clearance, and recognition readiness. Automatic and manual activation now read this reviewed-only shortlist, never the provisional ranking, and still require `OIL_RECOGNITION_ACTIVATION_ENABLED=true`.
- Introduced authenticated `POST /api/oilandgas/editor/recognition/review-approve`. This requires an existing pending AI review, matching revision and Crossref record, an editor-provided public HTTPS integrity-evidence URL, 30–1200 character editorial rationale, and explicit confirmation. Approval makes a review eligible for future shortlisting but **does not activate any recognition, issue a certificate, or send email**. This is documented human integrity clearance; independent automated retraction feed integration remains outstanding.
- Editor's Desk now displays reviewed-only shortlist separately from provisional ranking, and includes a documented integrity-approval form.
- Added `tests/oilandgas-recognition-selector.test.js` and updated the existing GitHub CI workflow to run it.
- Executed 8 isolated pure-JavaScript selection and safety checks via the GitHub-fetched current code; **8/8 passed**. These checks do not replace Node CI or browser/Heroku smoke tests.
- JavaScript syntax of updated recognition.js and recognition.html validated; GitHub combined commit status returned no checks and the workflow-run lookup returned no visible runs for the selected commit. Therefore CI completion remains **UNCONFIRMED**.

### Strict operational constraints
- Congratulatory recognition email remains a *non-sending placeholder*; do not connect transports or enable outreach without separate user approval.
- Auto schedule and recognition activation are OFF/LOCKED unless explicitly configured. **Do not set activation flag yet.**
- No recognition selections or certificate issuance were performed this turn. Existing homepage highlights, member email workflows and JALAN files were not changed.
- The reviewed-only shortlist may legitimately show **zero candidates** until evidence-based reviews are completed, properly documented and cleared. Do not fall back to provisional ranking for activation.

### Next engineering work
1. Independently run full Node test suite in CI with confirmed results.
2. Verify current Heroku deploy and frontend GitHub Pages production routing.
3. Implement scheduled batch evidence reviews and automated publication integrity checks (Crossmark/Crossref/other authoritative sources), keeping unverified cases pending.
4. Test editor approval transactionality and admin identity/audit trace.
5. Test weekly recognition simulation without writes to production or email. 
