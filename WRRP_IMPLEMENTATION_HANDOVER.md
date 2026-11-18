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

## Continued engineering — 16 November 2026 (A4 letter design locked & engagement tracking)
- User explicitly approved the earlier A4 recognition LETTER mockup, requesting an admin indication when a recipient clicks the email link and loads the letter.
- Added `WRRP_LETTER_DESIGN_LOCK.md` documenting official A4 portrait, justified, charcoal/orange/gold recognition LETTER (replaces certificate as author-facing terminology). No unauthorized signature or nonworking QR code fabricated.
- Added `Zux12/oilandgas-website/letter.html`: printable A4 portrait page with justified body paragraphs, wordmark, gold border lines, decorative seal and verification; accepts an optional private visit token and removes it from the visible address bar immediately.
- Previous `certificate.html?id=...` links now redirect to `letter.html?id=...` for backwards compatibility.
- Email HTML mockup now states Official A4 Letter of Recognition and uses `{{TRACKED_LETTER_URL}}` placeholder. No email sender/queue has been introduced.
- New `recognition_letter_links` documents use a randomly generated 32-byte opaque token, only its SHA-256 digest stored in the database. Admin-only creation requires an already-issued valid recognition ID and returns a private unsent testing URL.
- `GET /api/oilandgas/recognition/letter-link/:token` counts LINK REQUESTS and redirects to the letter. Security scanners may generate these requests; this is NOT proof the author clicked or read an email.
- `POST /api/oilandgas/recognition/letter-view` counts PAGE LOADS only after valid recognition data is rendered in a browser. Corrected cross-origin OPTIONS preflight for the public site. Page-load signal is NOT proof the intended author personally read the letter.
- `GET /api/oilandgas/editor/recognition/letter-tracking` is private behind Editor's Desk authentication; admin UI now shows per-letter link requests, letter loads, last activity and recognition email status (disabled).
- Added `tests/oilandgas-recognition-letter-tracking.test.js` to Node CI, plus syntax checks for new backend and HTML embedded JS.
- No recognition email sent, no tracking token generated in production, no recognition issued. Activation and schedule remain LOCKED/OFF.
- **Not yet tested on live website:** GitHub commits and JS syntax checks alone do not establish deployed Heroku or GitHub Pages behavior, actual PDF layout/print quality, live CORS, or analytics accuracy. Do not claim those passed.
- Need to check true author-facing A4 print on Safari and Chrome (one page) and consider a signed/working verification QR code later.

## Permanent once-only recognition rule — 16 November 2026
- User explicitly rejected returning recognition: **once a publication is selected in any recognition category, that publication must never be selected again**, regardless of time elapsed. No 12-month expiry, no anniversary/repeat award.
- Updated recognition-selector.js `paperCooldown` to lifetime exclusion by stored publication reference or matching stable publicationId, independent of recognition category/date.
- Updated recognition.js: provisional candidate pool and reviewed-only selection history both include all past active/archived/withdrawn selections without 1,000/2,000 record limits or 12-month lookback. These provide lifelong exclusion for previously recognized papers.
- When no eligible new research exists, leave that category unfilled for the week. Preserve prior winners only in the archive; do not call them new winners.
- The **12-week author cooldown remains a preference** between distinct eligible papers, not a ban on an author ever receiving recognition for a different paper.
- Added lifetime exclusion regression tests for years-later selection, renamed reference with same publication ID, and exhausted pool. Four isolated checks passed using fetched JavaScript; full Node CI and deployment remain unverified.
- No emails, awards, tracking links, production recognition records or scheduler settings were changed.

## Continued implementation — 18 November 2026 (newly published papers and full-paper evidence gate)
- User approved newly uploaded/published papers entering recognition consideration automatically, with no separate award application, fair competition and full-paper evidence requirements (not just title/abstract).
- Added `server/oilandgas/recognition-evidence.js`: validates four source-backed research evidence sections (methodology, results, limitations and industry implications), original HTTPS evidence URL, and editorial confirmation that the full paper was examined.
- Added authenticated `GET /api/oilandgas/editor/recognition/candidate-queue`: derives a private recognition consideration queue from the existing `status:'published'` publication collection. Because it is computed from current published data, new publications appear without a separate recognition application. States: recognized-once, full-paper-evidence-needed, ai-assessment-needed, editorial-integrity-review-needed, ready-for-shortlist.
- Added authenticated `POST /api/oilandgas/editor/recognition/evidence`: stores a revision-bound editorial evidence packet in `recognition_evidence`, records an audit entry and invalidates prior AI review status if evidence changes. No recognition or email sent.
- Updated `recognition-review.js` to refuse AI assessments if no full-paper evidence packet is present (returns `evidence_required`). The AI prompt now uses manuscript evidence extracts as well as the publication metadata; no claim that the model independently read the original PDF is made. Results are labeled `ai-full-paper-evidence-assessment`.
- Updated the reviewed-only automatic selector and editorial approval gate to reject all metadata-only AI assessments. Approval remains conditional on matching bibliographic record, independently documented publication-integrity clearance and minimum scores.
- Added admin candidate queue and source-backed evidence entry panel in `server/oilandgas/desk/recognition.html`.
- Strengthened once-only permanent exclusion using source/DOI identity in addition to reference and stable publication ID to discourage duplicate re-entry.
- Updated tests for `recognition-review`, `recognition-selector`; created `tests/oilandgas-recognition-evidence.test.js`, expanded GitHub Actions workflow. Syntax checks passed for updated JavaScript modules and admin inline JS. Isolated evidence validation checks passed with a URL implementation supplied to the testing sandbox; complete Node CI/live deployment still unconfirmed.
- No author emails sent or enabled. WRRP activation flags remain OFF/LOCKED. No real recognition awarded or letter issued.

### Remaining implementation limitations
- The full-paper evidence packet currently requires editorial review/entry of source-backed methodological/findings information. Automatic safe full-text PDF extraction and independent document verification are NOT yet implemented; do not claim uploaded paper files are automatically analyzed end-to-end.
- Source URL validity alone does not establish publisher availability or research integrity. Editors must inspect the paper and document credibility checks before granting shortlist approval.
- True browser testing, Heroku deployment status, and full Node test suite execution remain to be verified.

## PRE-DEPLOYMENT DECISION TRACKER — 18 November 2026

### Decision 1/8: Recognition assessment architecture — LOCKED
**User decision:** Rule-based ONLY, but program it to behave intelligently, with adaptive-looking multi-factor assessment and transparent, explainable decisions. This means NO generative AI, NO model API, and NO LLM in scoring, ranking or automatic selection. Do not present the system as actually performing AI or as understanding scientific merit through a model.

**Design direction:** deterministic evidence/metadata extraction and checks; fixed weighted 100-point scorecard; verifiable research features (source status, methodology markers, quantitative results, operational relevance, limitations, novelty markers) with rule-based NLP/token/phrase extraction where useful; category-specific sorting, uniqueness by DOI/source, minimum thresholds, diversity preferences, written scoring rationale, admin override, integrity hold, and fail-closed behavior for weak or inaccessible evidence. Clear distinction between metadata heuristic signals and verified claims. Repeatable output for identical inputs and a versioned ruleset.

**Architecture consequence:** Existing `recognition-review.js` and `recognition-selector.js` currently depend on an OpenAI-produced `ai-full-paper-evidence-assessment` and `OIL_RECOGNITION_OPENAI_API_KEY`; they must be refactored before launch to use purely deterministic evidence assessment. The current gate is not yet compliant; do not claim the program is converted until changes and tests are complete. Keep email and recognition activation OFF.

**Remaining decisions 2–8:** paper evidence/access policy; auto-publication vs editor release safeguards; weekly category vacancy; co-author letter issuance; authorized signatory/verification; withdrawal policy; back-catalogue launch scope. Discuss sequentially with the user, tracking each final approval.

### Decision 2/8: Abstract and source evidence policy — LOCKED (18 November 2026)
**User decision:** Use the publication abstract as the primary research-content input for rule-based recognition scoring. Do NOT require full-paper access for routine selection. Supplement abstract analysis with original publication/DOI metadata and integrity verification. Full-paper inspection is an exception when the abstract is insufficient or concerns arise.

**Limits:** Abstracts may signal relevance, method, reported results, and potential impact, but cannot independently substantiate scientific novelty or actual deployed industry impact. Do not conflate claims with independently verified evidence or award maximum evidence/credibility points based only on strong abstract language. If source/integrity is unverified, hold recognition.

**Engineering implications:** Remove the currently mandatory full-paper packet gate from `recognition-review.js`, `recognition-selector.js`, `recognition.js`, and editor form before enabling activation; implement deterministic abstract screening with explicit confidence/evidence levels. Keep full-paper evidence as optional escalation. Existing implementation still requires full-paper evidence and uses AI; migration remains pending. Emails and activation OFF.

**Next:** Decision 3/8 — autonomous release policy vs administrator approval for winning papers.

### Decision 3/8: Autonomous weekly release — LOCKED (18 November 2026)
**User decision:** Option A, fully automatic weekly publication of qualifying recognition winners, with administrator override, withdrawal, and emergency pause controls. Scheduled target: Mondays at 09:00 Asia/Kuala_Lumpur.

**Safety interpretation:** "Qualifying" means the paper has met the locked deterministic abstract-first evaluation, source/DOI checks, evidence and integrity requirements, category score threshold, and permanent once-only recognition constraint. Failed/unavailable checks must never be treated as passes. Autonomous release must provide an audit record, be idempotent for the weekly cycle, and support admin pause/withdrawal after issue.

**Operational status:** This is a POLICY DECISION, not authorization to turn on production scheduling now. Recognition activation and email delivery remain OFF until implementation and tests finish; only a separate deployment decision can enable automatic publication. Recipient congratulations by email still require explicit approval later.

**Next:** Decision 4/8 — whether to leave a category unfilled when fewer than three qualifying new papers are available.

### Decision 4/8: Vacant categories and Friday admin alerts — LOCKED (18 November 2026)
**User decision:** Option A: publish only qualified winners; any category without a qualifying paper remains **unfilled**. Do not reduce thresholds, postpone the other qualified winners, or reuse a previously awarded paper. Additional requirements: admin must get an email alert if a category is vacant, admin must be shown the upcoming proposed winners, and winners must be selected **three days (72 hours) before Monday 09:00 MYT publication**. The admin alert email must have polished CSS branding.

**Implementation committed (not yet live-verified):**
- New `server/oilandgas/recognition-admin-alert.js`: Friday 09:00 MYT / Monday 09:00 MYT scheduling calculations; charcoal, orange and gold table-based HTML email with inline email-client-compatible CSS; plain text alternative; editorial winners, author names, scores, references, and conspicuous unfilled-category warning; HTML escaping for all publication metadata.
- `recognition.js` now prepares a frozen draft in `recognition_previews` for the following Monday when scheduler fires Friday 09:00 MYT; reserves one candidate or an explicit vacancy per category. On Monday, only Friday's proposed selections are reverified for current eligibility and publication integrity. If a proposed winner becomes invalid, category remains unfilled; no unannounced last-minute replacement is made.
- Monday activation now supports 0–3 actual winners, recording unfilled categories. Selection identity/date remain unique, with previous recognition permanently excluded.
- Admin-only `GET /api/oilandgas/editor/recognition/friday-preview` reports status, next Monday, Friday prep time, planned winners, vacancies and email setup state; `GET .../friday-preview/email-html` previews the branded HTML email without sending.
- Admin dashboard now shows the Friday briefing, a link to styled HTML email preview, and persistent emergency pause/resume controls. Pause blocks scheduler and manual activation and is audited.
- Admin-only SMTP delivery uses the existing Resend SMTP transport via `OIL_ARTICLE_RESEND_KEY`, but needs `OIL_RECOGNITION_ADMIN_EMAIL` set to the user's chosen recipient and explicit `OIL_RECOGNITION_ADMIN_ALERTS_ENABLED=true` once tested. It uses a dedicated `recognition_previews.emailStatus` idempotency claim and never connects to author email sending. Do NOT guess admin email; not configured by these commits.
- For safety, the live schedule ALSO requires `OIL_RECOGNITION_RULES_READY=true`, `OIL_RECOGNITION_ACTIVATION_ENABLED=true` and `OIL_RECOGNITION_AUTO=true`, all OFF by default. This prevents accidentally launching the old AI-dependent reviewed selection before completing Decisions 1–2 migration.
- Added `tests/oilandgas-recognition-admin-alert.test.js` to GitHub Actions; isolated 9/9 checks passed for time arithmetic, vacancy handling, escaping, admin-only settings, disabled author email and launch gate. Full CI and live Heroku/mail delivery not yet confirmed.
- Neither an admin email nor any author congratulatory email was sent. No scheduled preview was created in production during these code commits.

**Pending operational setup:** user must specify the administrator recipient email address (and whether any additional admin recipients are permitted) before configuring `OIL_RECOGNITION_ADMIN_EMAIL`. Confirm sender-domain SMTP acceptance, email-rendering in Gmail/Outlook, and failover alerts for failed sends. Keep admin alert sending OFF until recipient and live tests are confirmed.

**Next:** Decision 5/8 — individually addressed recognition letters for verified co-authors. Continue one by one.

### Administrator recipient and Hostinger SMTP — 18 November 2026 (configured in source, not activated)
- User designated administrator recipient **m.zurix@oilandgas.eu.com** and requested Hostinger outbound SMTP for Friday WRRP alert emails.
- Hostinger official settings: `smtp.hostinger.com`, SSL/TLS port `465` (fallback port `587` with STARTTLS). SMTP mailbox username should be the complete mailbox address; FROM is the authenticated address.
- Recognition administrator alert code now defaults to `OIL_RECOGNITION_ADMIN_EMAIL=m.zurix@oilandgas.eu.com` and `OIL_RECOGNITION_SMTP_USER=m.zurix@oilandgas.eu.com`, uses `OIL_RECOGNITION_SMTP_PASSWORD` (hosting environment secret, not repository), optional `OIL_RECOGNITION_SMTP_PORT=465`, and will only send if `OIL_RECOGNITION_ADMIN_ALERTS_ENABLED=true` plus the separate recognition scheduler launch flags are set.
- Recognition admin alerts no longer depend on Resend SMTP. Existing other emails using Resend remain untouched. Author congratulatory emails remain disabled.
- **Environment secret not configured here**, no SMTP connection attempted, no email sent. Hostinger authentication and delivery remain unverified. Avoid asking for mailbox password in chat; set it in Heroku Config Vars or equivalent protected secrets store.
- Review the domain's actual Hostinger email product settings before sending; default values apply to Hostinger Email mailboxes, not necessarily other mailbox products.

### Decision 5/8: Individual verified co-author letters — LOCKED (18 November 2026)
- User explicitly approved **a separate personalized A4 Letter of Recognition for every verified co-author** on the winning research paper, rather than one shared letter.
- Per-letter name must match verified published byline. Each letter has a unique verification reference linked to the single lifetime recognition of that paper. Co-author recognition must not bypass one-time-only paper selection. Author congratulatory email delivery remains OFF; this decision covers the document, not activation of author mail.
- Next: test standalone Hostinger SMTP administrative test email (explicit user consent to test), then Decision 6/8 (authorized letter signatory and QR verification).

### One-off admin SMTP test facility — 18 November 2026
- User confirmed `OIL_RECOGNITION_SMTP_PASSWORD` was added to Heroku Config Vars and approved conducting a Hostinger SMTP test now.
- Added authenticated `POST /api/oilandgas/editor/recognition/admin-email/test`: requires explicit confirmation token `SEND_ADMIN_SMTP_TEST`, tests Hostinger SMTP connectivity via `nodemailer.verify()`, then sends exactly one test message to **m.zurix@oilandgas.eu.com** using the existing environment secret; no secret returned or written to GitHub.
- Email subject is clearly prefixed **[SMTP TEST — NO AWARDS]**. Message explicitly states it is a test and does not represent real winners. Test uses styled admin notice layout. Sending is limited to once every 10 minutes by MongoDB claim, with status and audit record. This endpoint is separate from (and does not enable) automated Friday alert scheduling or author congratulations.
- Added confirmation-button **Send one test email to admin** in the authenticated `server/oilandgas/desk/recognition.html`; it reports SMTP acceptance (distinct from confirmed inbox delivery).
- **Live result:** Not sent or verified by assistant; the authenticated Heroku editor view cannot be reached from the available web transport. The user can log into Editor’s Desk and click once after the deployed code is available. Verify Heroku deployment and post-test inbox receipt; avoid saying a message was sent until SMTP accepted it.
- WRRP decisions tracker is now **5/8 locked**. Next Decision 6 is the authorized letter signatory and working QR verification.

### Safari CSP editor dashboard fix — 18 November 2026
- User supplied Safari screenshot of `/api/oilandgas/editor/recognition.html`: the editor page displayed unstyled plain HTML and Safari Inspector showed `Refused to apply a stylesheet` and `Refused to execute a script` due to `style-src 'self'` / `script-src 'self'` Content Security Policy.
- Root cause: original recognition.html embedded an inline `<style>` and `<script>` and 20 `style="` attributes; CSP correctly prohibited them. This was NOT proof the button was missing or that Heroku had not deployed the latest HTML.
- Extracted stylesheet to `server/oilandgas/desk/recognition.css` and JavaScript to `server/oilandgas/desk/recognition.js`, with relative versioned URLs and transformed all static inline style attributes into CSS classes.
- Updated Editor's Desk `server/oilandgas/editor.js` static asset allowlist to serve those exact external files. Kept strict CSP, no inline JS, no unsafe-inline policy relaxation.
- Validated editor HTML has no inline script/style attributes, external resources are referenced, CSP permits self-hosted files, SMTP test button and click handler are present, and JavaScript syntax check passed (13 assertions). The live URL could not be retrieved from available web tool, so **actual Heroku deploy and Safari functional retest remain unverified**.
- Admin test-email sending remains manual and requires an explicit click in the authenticated Editor's Desk. No email sent; author emails and recognition activation remain disabled.

### Hostinger administrator SMTP acceptance test — user verified 18 November 2026
- User provided a screenshot of the **received** inbox message at approximately 16:27 Malaysia time, sent as **Oil & Gas Research Recognition** to **m.zurix@oilandgas.eu.com**, with subject beginning `[SMTP TEST — NO AWARDS]`.
- Screenshot confirms the HTML email displayed successfully: charcoal branded header, gold test banner, title, dates, and vacancy warning.
- The message contained a synthetic test preview with all three categories unfilled; **this is not evidence the actual research selection evaluated the papers or found no winners**.
- Mark one-off Hostinger SMTP administrator email test as PASSED at recipient/inbox level. No author congratulatory email was sent. Friday live alerts and automated weekly recognition remain OFF pending rule-only assessment migration and deployment authorization.
- User has not approved Decision 6/8 yet.

### Decision 6/8 — Editorial signatory and signature flourish (18 November 2026)
- User approved signatory label **Oil & Gas Editorial Team** and expressly requested an elegant handwritten-style visual flourish similar to the previously approved A4 mockup.
- Updated `Zux12/oilandgas-website/letter.html` with a decorative scalable SVG editorial flourish immediately above the typed `Oil & Gas Editorial Team` signatory. It is an **organizational design mark**, not a forged or purported wet signature of a particular human individual.
- A4 portrait and justified body, wordmark, gold seal, unique reference and recognition verification remain unchanged. Embedded SVG is static and does not fetch external resources.
- QR code generation and verification destination still need functional testing before calling the letter's QR verification complete; do not invent or link an unverified code.
- Official author-recognition email delivery and automatic weekly activation remain OFF. Live website deployment and browser print fit require verification.
- Next: Decision 7/8 — withdrawal/retraction response, then Decision 8/8 — launch scope/back-catalogue (assuming Decision 6's signing requirement accepted as locked).

### Decision 7/8 — Retraction and integrity withdrawal policy — LOCKED (18 November 2026)
- User approved **automatic suspension of recognition** when a credible retraction or serious research-integrity notice is detected. Suspended recognition must be hidden from active featured winners pending validation and re-checks; its official letters should be invalidated and the administrator notified.
- Retain an archival record marked **Recognition Withdrawn** rather than silently deleting recognition history. Maintain the reason, evidence URL(s), detection timestamp, and audit history, and do not allow withdrawn papers to be recognized again under the once-only policy.
- Technical safety requirements for implementation: authoritative-source verification (e.g. publisher/Crossmark or Crossref updates where supported), conservative conflict handling, review for disputed/unclear signals; avoid automatically labeling a paper as scientifically retracted on weak signals. Existing manual withdrawal workflow is not proof that automated retraction monitoring is implemented.
- Keep administrator Friday alerts independent from author congratulatory emails. Recognition automation and author emails remain OFF pending complete testing.
- Next Decision 8/8: whether the initial pool includes **all existing eligible published papers** plus incoming ones, or only newly published papers after launch.

### Decision 8/8: Launch candidate pool — LOCKED (18 November 2026)
**User decision:** Option A. Include **all previously published, eligible research papers already in the Oil & Gas directory**, alongside every subsequently published eligible paper. No launch-date cutoff or 12-month publication-age restriction. Apply the same evidence, score, source-integrity and permanent once-only recognition rules to every paper, regardless of original publication date. Papers previously recognized or withdrawn remain ineligible for another recognition.
- This is approval of the selection **scope**, NOT approval to enable automatic recognition, switch on Friday alerts, or send author emails.
- Engineering requirement: remove any artificial candidate count limit that would silently exclude older back-catalogue entries; consider pagination/performance if the directory grows substantially. Ensure the source record must have status `published` and a verifiable original-publication link.
- The 8/8 policy decisions are now LOCKED. Next phase is engineering compliance, simulations and controlled launch authorization; do not ask these policy questions again unless the user requests changes.

### Deployment-readiness review — checkpoint 18 November 2026
Policy decisions: 8/8 locked, but NOT production ready yet.
1. **BLOCKER — rule-based scoring conversion:** Current `recognition-review.js` uses OpenAI and the reviewed-only `recognition-selector.js` expects an `ai-full-paper-evidence-assessment`. Decision 1 requires *no AI or model API*. Design and test deterministic abstract-first 100-point scoring with traceable evidence, confidence bounds and transparent reasons.
2. **BLOCKER — abstract-first gate:** `recognition.js` still requires editor-recorded full-paper packets before assessment. Decision 2 replaces this with abstract-first screening and independent bibliographic/integrity checks; full paper becomes escalation only. Test mixed abstracts, poor/missing abstracts and unavailable DOIs.
3. **BLOCKER — autonomy and schedule:** Friday 09:00 MYT frozen candidate briefing and Monday 09:00 MYT publication exist in code, but scheduler flags still require explicit activation and `OIL_RECOGNITION_RULES_READY=true`. Verify idempotency, restart behavior, 72-hour draft, status notifications and no last-minute substitutions.
4. **BLOCKER — empty categories:** Monday code supports 0–3 winners, but all workflows/public UI must clearly represent vacancies and tests must simulate 0,1,2,3 qualified categories. No minimum-score dilution and no reused winner.
5. **BLOCKER — automated integrity lifecycle:** Manual withdrawal, letter invalidation and audit are implemented; automatic trusted-source retraction detection, conservative suspension, admin alerts and public archive status for withdrawn records need work. Current public `/archive` filters active/archived only and therefore does not yet display withdrawn history as decided.
6. **BLOCKER — letter verification:** Individual issued records have unique IDs, A4 letter page and organizational flourish; need verified per-co-author issuance, functioning QR, browser A4 PDF print validation, and full source/title/byline correctness.
7. **BLOCKER — author outreach:** Congratulatory emails stay OFF until separately approved; no production selection, letter or sender queue should trigger them.
8. **OPERATIONS — admin mail:** User confirmed receipt of branded Hostinger SMTP **test** email in inbox on 18 Nov. This validates one-off admin message, not Friday schedule, queue retries or delivery reliability. Verify configured recipient, monitoring, duplicate protection and failure alerts before enabling `OIL_RECOGNITION_ADMIN_ALERTS_ENABLED`.
9. **TEST & DEPLOY:** Full CI and E2E checks, permissions, historical selection migration, data integrity and production traffic load not yet established. Strict CSP fix was verified via user's screenshots; isolated source checks do not equal production acceptance. Maintain all activation gates OFF until explicit approval.

**Launch gate:** DO NOT enable `OIL_RECOGNITION_AUTO`, `OIL_RECOGNITION_ACTIVATION_ENABLED`, `OIL_RECOGNITION_RULES_READY`, or author email sending until implementation/test evidence satisfies the above and user approves release.

### Decision 8 catalogue scope code adjustment — 18 November 2026
- Removed the preexisting `.limit(1500)` from `recognition.js` published-paper candidate query so no arbitrary 1,500-item cap excludes older published papers. Syntax checks on recognition backend, selector, reviewer and editor JS passed. Full-load database performance/pagination testing remains pending; do not call this production-ready.

### Legacy OpenAI assessment runtime evaluation — 18 November 2026
User requested a firm functional verdict about whether the OLD GPT-4.1-mini recognition reviewer can still be used.
- Reopened current `server/oilandgas/recognition-review.js`, `recognition-evidence.js`, `recognition-policy.js`, `recognition.js` from GitHub.
- Confirmed reviewer invokes OpenAI Chat Completions default `gpt-4.1-mini` using `OIL_RECOGNITION_OPENAI_API_KEY`, only after source-verified full-paper evidence passes `validatePacket`. Live env variable presence is NOT verifiable via available connector.
- Ran isolated JavaScript functional execution with mock Crossref fetch and mock OpenAI client, NOT a real paid OpenAI request. With valid simulated metadata and complete verified evidence, scoring finished `state=reviewed`, total 86/100, no automatic approval or author email.
- Tested missing paper evidence -> `evidence_required`; missing API key -> `configuration_required`; bibliographic title mismatch -> `blocked`; out-of-range scoring rejected. **All isolated functional assertions passed.** Simulated one OpenAI completion; zero real OpenAI requests.
- Queried connected MongoDB Atlas `oilandgas` database. Collections `recognition_evidence` and `recognition_reviews` do **not exist** (find queries return zero documents). There are published paper records, with abstracts and DOI sources; e.g. `OG-P-77DC6CDBE681033C` points to `https://doi.org/10.1126/sciadv.aaz5120`.
- Attempted a public real Crossref DOI call; web retrieval was unavailable for the selected DOI, so no live successful Crossref request can be claimed for that paper; Crossref REST API documentation confirms the supported endpoint.
- **Firm verdict: OLD REVIEWER SOURCE LOGIC WORKS WITH TEST DOUBLES, BUT IS NOT OPERATIONALLY USABLE ON CURRENT PRODUCTION DATA.** Every manual review currently fails before OpenAI due to no verified full-paper evidence record; API credential state and live Heroku service are unverified. Do not say real OpenAI/Crossref integration passed.
- No recognition selection, author email, admin alert or production configuration changes were made. Continue planned replacement with approved deterministic abstract-first rules engine; production launch flags OFF.
