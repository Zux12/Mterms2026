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

### Keyword-only fairness and explainability checkpoint — 18 November 2026
- User expressed conditional acceptance of **keyword-rule-only recognition** if the same rules are applied fairly to all papers and each assessed criterion can be clearly justified.
- Added `WRRP_KEYWORD_ASSESSMENT_FAIRNESS.md`: verbatim current 100-point dimensions and current binary trigger methodology, their limitations, proposed disclosures to researchers, and required fairness safeguards before activation. This policy document is a specification, NOT evidence that the full fairness safeguards have been implemented.
- Live MongoDB `oilandgas.publications` audit: **124** published records, **121** stored publication summaries shorter than 250 characters, and average stored summary length approximately **143.4 characters**. These are mostly brief directory summaries, not comparable full abstracts. A fair launch must retrieve and normalize original abstracts where possible or mark insufficient evidence as assessment pending; do not assign low scores just because the summary is truncated.
- Added no-score-change transparency metadata to existing provisional `scorePaper`: matched text signal for each criterion, rationale and limitations, `rubricVersion=provisional-keyword-v1`, and input character count. Updated deterministic repeatability test coverage. Three isolated cases ran and each returned repeatable scores and six explanations (100, 8, 70).
- A clear limit: the current regex is substring/binary matching, so a single word can award full points and a URL currently awards full evidence points. This is NOT defensible as final scientific-merit scoring. Whole-word checks, graduated points, source provenance, evidence caps and topic fairness still required before any live winners.
- The reviewed-only selector still demands `ai-full-paper-evidence-assessment` and is NOT yet converted to a keyword-only award pathway. Do not set `OIL_RECOGNITION_RULES_READY`, activation or auto flags.
- Author congratulatory emails remain OFF. No recognition issued or notifications sent in this step.

## Recognition-section engineering pass — 18 November 2026 (all 8 policies preserved)
User asked to finish as much of the WRRP recognition section as possible and return to discussion later. Work below was committed in this turn; **no production flags, emails or awards were activated**.

### Rules engine and independent source screening
- Created `server/oilandgas/recognition-rules.js` (rubric `keyword-abstract-v2.0`): deterministic **NO AI/LLM/API** scorer, six groups with max weights 25/20/20/15/10/10; graduated domain-specific evidence, exact matched phrases/reasons, identical scoring across all papers, no free points for mere URL presence; short or unverified abstracts remain pending.
- Specialty fairness improvement: a clear substantive oil/gas domain match earns strong relevance credit; papers aren't forced to mention unrelated sectors for points. Repeating terms doesn't inflate scores. This is editorial screening, NOT scientific peer review or independent originality validation.
- `server/oilandgas/recognition-source.js` conservatively imports only sufficiently complete original abstracts from matching Crossref DOI metadata, strips JATS markup and saves authoritative Crossref coauthor names when available. Non-DOI/unavailable abstract stays pending. Added admin import-by-reference and bounded batch discovery (up to ten per admin request, five per scheduled poll); unsuccessful automatic DOI discovery is retried after seven days. Added admin original-abstract provenance form for publisher/repository abstracts omitted from Crossref.
- `recognition.js` now routes **verified weekly selection** to deterministic `recognition_rule_reviews` rather than old `recognition_reviews`/OpenAI. A source check must be current (last seven days), match the publication revision, have a verified original abstract, and pass the 85/75 score thresholds. The **old OpenAI reviewer remains as a labeled legacy manual comparison facility only**, not part of winner selection.
- Automatic source check (in guarded scheduler): original Crossref DOI title and abstract must match the stored text, with recent Crossref known-retraction lookup; absent notice means **only no known indexed notice was found**, not proof of scientific quality. This limited editorial-source screen is transparently recorded with scope and can be corrected or superseded by documented authenticated editor integrity approval. Missing/unavailable/conflicting information fails closed.

### Selection, overrides and lifecycle
- Updated `recognition-selector.js`: prevent same original DOI/source appearing in multiple weekly categories or ever winning again; keep the 12-week author cooldown preference; preserve the published minimum thresholds.
- Staged manual overrides now influence the **verified** Friday shortlist only when the pinned paper meets the same score, source, freshness, non-repeat and integrity conditions. Override validation cannot bypass other categories by duplicating the same paper.
- Friday 09:00 MYT draft remains frozen for Monday 09:00 MYT publication; Monday rechecks the EXACT same candidates and leaves invalid/vacant categories empty. Nothing is substituted behind the admin's back. Friday admin briefing uses branded HTML and only Hostinger SMTP when separately enabled.
- Created `server/oilandgas/recognition-integrity.js` with explicit Crossref retraction notice detection; guarded scheduling checks active/archived recognitions, transactionally withdraws explicitly retracted selections, invalidates associated letter records and writes admin-only integrity alerts. The public archive now includes withdrawn histories. No finding is inferred from mere lack of notice.
- Monday transactional activation now automatically creates a separate verified-letter record for each Crossref-matched coauthor name that exactly matches the published byline. Unmatched coauthors are NOT guessed and remain eligible for authenticated manual issuance. **No author notification is sent.**

### Website and administration
- Reordered `Zux12/oilandgas-website/index.html`: **Weekly Research Recognition** is the first featured content block, above the existing Weekly Industry Brief and independent Editor's Picks. New `recognition-feature.css` and `recognition-feature.js` render the leading **Research Editor's Pick of the Week** and two supporting categories. Before actual programme activation, the page truthfully says controlled testing; it never invents winners.
- Added public `recognition-detail.html` for a recognized paper with author/title, verified source, date, editorial rubric breakdown, keyword evidence rationale, unique record and withdrawn status. Archive cards link to this detail page, public `GET /api/oilandgas/recognition/record/:id` serves only active/archived/withdrawn records.
- Editor's Desk now offers a read-only rules scorecard with exact evidence terms, candidate queue with source-pending state, a Crossref import-by-reference tool, five-at-a-time DOI discovery, a manual-original-abstract verification form, source/integrity approval, Friday draft and admin email preview, verified shortlist, emergency pause, tracking and integrity-monitor status. Static assets stay CSP-safe and external; existing non-recognition sections were not changed.
- Added / updated regression tests and workflow coverage for rule scoring, Crossref original abstracts, explicit retraction signals, override guards, DOI duplicates and no-author-email safeguards.

### Checks and restrictions
- Isolated fetched-code checks: **9/9 passed** for deterministic score bounds, source-verification and duplicate guards, editor overrides, replay exclusion, no-auto-email and activation lock. JavaScript syntax passed for all core backend and frontend modules. This does **not** replace a full Node CI, real Crossref network, Heroku or Safari end-to-end test.
- Existing database audit before this pass: 124 published papers; 121 stored directory summaries shorter than 250 characters. Existing records largely **do not yet have verified original abstracts**, so many may be pending; no incorrect score-based award should be fabricated.
- `OIL_RECOGNITION_RULES_READY`, `OIL_RECOGNITION_ACTIVATION_ENABLED`, `OIL_RECOGNITION_AUTO`, `OIL_RECOGNITION_ADMIN_ALERTS_ENABLED` all remain **OFF** unless a human has separately changed hosting configuration. Nothing in this pass enabled them, created a recognition winner, issued real letters in production or sent an email. The earlier Hostinger admin SMTP test was confirmed as received; that does not authorize automated sending.
- **Still pending for production:** full GitHub Actions/Node test result, live Heroku frontend/backend deployment and authenticated smoke tests, original abstract backfill/source coverage and fairness review across disciplines, seven-day freshness source checks in real network, complete coauthor identity matching including records without Crossref authors, one-page A4 PDF printing, and a working QR-code verifier. Do not assert the recognition programme is now live or finished to production standard.
- Handover next step: continue end-to-end testing and close remaining blockers, **do not activate automatic awards or author congratulatory mail** before explicit user approval.

## Admin master activation switch and letter/email readiness — 18 November 2026
- User asked to have a master activation switch in the recognition control page and asked whether the A4 "certificate"/letter and congratulatory author email system were finished and who sends messages.
- Implemented authenticated `GET /api/oilandgas/editor/recognition/activation-control` and `POST .../activation-control` with persistent MongoDB `recognition_controls.enabled`, status checklist and explicit typed confirmation. `enabled` defaults to FALSE if no record exists. Master toggle now gates `scheduledTick` and `activateCycle` in addition to legacy environment flags and admin pause. OFF stops future automatic cycles without deleting archives.
- Production ON is intentionally refused unless all four environment settings are explicitly true: `OIL_RECOGNITION_RULES_READY`, `OIL_RECOGNITION_AUTO`, `OIL_RECOGNITION_ACTIVATION_ENABLED`, and **new** `OIL_RECOGNITION_RELEASE_APPROVED` (signals independently completed E2E and release authorization). This new flag was **not** set and is OFF by default. No programme was enabled by this code change.
- Editor's Desk now displays a prominently labelled master activation checkbox with individual readiness flags. Admin-only access; safe CSS/JS external assets preserve existing CSP. Author congratulations remain a completely separate and disabled function that the master switch CANNOT enable.
- 10/10 isolated source-level safety assertions passed (backend/admin syntax, gating, default OFF, author email separation, and visible switch); full live end-to-end test and complete CI still pending.
- **Co-author A4 document readiness:** `letter.html` is a printable A4 portrait web document with branded editorial flourish and database-backed verification ID. Unique records may be created for exact source-verified byline matches; unmatched names need authenticated editorial verification. It is NOT a fully tested, server-generated PDF; printed single-page layout, genuine QR-code generation/verification, all coauthor coverage and end-to-end revocation tracking are still unfinished.
- **Author congratulatory mail readiness:** styled `recognition-email-preview.html` is a design-only template; no author sending transport, opt-in/suppression workflow, confirmed per-coauthor recipient identity/email mapping, queue, retries or bounce handling are connected. Thus recognition winners or issuing letters DO NOT automatically generate or send email.
- **Existing Hostinger administrative SMTP:** uses mailbox `m.zurix@oilandgas.eu.com` for approved owner Friday alerts and successful one-off admin SMTP test; this does not authorize sending to academic authors. Proposed separate sender such as `recognition@oilandgas.eu.com` requires the mailbox to be created/authorized, Hostinger credential safely configured and explicit approval. Never forge/from an unconfigured mailbox.
- No author messages sent, no new real recognition winners selected, no environment deployment flags or hosted secrets changed.

### Printable letter QR verification checkpoint — 18 November 2026
- Implemented real self-hosted QR code on `oilandgas.eu.com/letter.html?id=...`; QR opens `verify-letter.html?id=...` with a live server check, author and paper identity, category, issue date, and VALID / WITHDRAWN / INVALID / UNAVAILABLE states.
- New backend `recognition-letter-verification.js`; original `/recognition/verify/:id` now checks parent recognition status as well as letter status. Withdrawn parent revokes printed/PDF QR validity on scan even if letter record update is incomplete; response Cache-Control no-store.
- QR does not carry a private tracking token, email address or sensitive secret; library is self-hosted under its MIT license with attribution. Printed letter retains the approved A4 portrait presentation and a QR in the footer.
- Ten isolated source-level assertions passed; GitHub Actions regression test file/workflow updated. **Real live QR scanning, production deployment verification and A4 single-page print checks remain pending**, so this is implemented, not fully field-tested.
- No recognition winners issued, no author notifications sent, master activation stays OFF. The next action is a controlled staging letter and end-to-end printed scan including revocation.

### Permanent dated recognition QR policy correction — 18 November 2026
- User rejected treating historical awards as expiring or becoming absent from QR verification. Recognition is a permanent dated historical record tied to the author and original paper, regardless of a seven-day spotlight period.
- Changed verification status and public detail UI: `recognized` after current/archive; `recognized-with-notice` if a subsequent editorial/integrity notice arose. Retain original recognition date and show later notice separately for factual transparency. Only missing/malformed records are not verified.
- Letter remains retrievable/printable as historical recognition even after subsequent notice. No email or award issued. Updated QR regression coverage.

### Read-only full-flow recognition simulation — 18 November 2026
User authorized a complete simulated recognition and letter/QR workflow; this was conducted **without issuing any actual award, letter, author email or unlocking production flags**.
- Grounded selected real directory publication: `OG-P-77DC6CDBE681033C`, *Quantifying methane emissions from the largest oil-producing basin in the United States from space*, DOI `10.1126/sciadv.aaz5120`. Production MongoDB record has title, short summary and byline but **no independently verified complete original abstract**. Deterministic evaluator correctly returns `source-backed-abstract-insufficient` and `abstract-source-not-confirmed`; real paper remains `assessment pending`, not awarded.
- Separate simulated complete source-backed abstract **not asserted to be authoritative Crossref content** for this paper scored **64/100** on rubric v2 (relevance 22, technical 18, practical 8, evidence 11, originality 0, timeliness 5); no category threshold passed. This is a diagnostic test, not a scientifically valid real-paper score.
- Friday Nov 20, 2026 at **09:00 MYT** locks Monday Nov 23, 2026 at **09:00 MYT**: exact 72 hours. Empty categories stayed vacant and owner preview template reported 3 unfilled; no mail was dispatched.
- Added `tests/oilandgas-recognition-simulation.test.js` to backend repo and recognition CI workflow. Uses real directory metadata only for pending case; a clearly labelled **fictional engineering publication with fictional coauthors** for all-success path. Tests 3 distinct qualified categories, score thresholds, empty-category behavior, verified source-byline coauthor matching, unique per-coauthor QR URLs, lifecycle from active to archived and with separate later integrity notice. **7/7 source-executed simulation tests passed.** No DB modifications.
- Added site repo `tests/recognition-qr-layout.test.js` and `.github/workflows/recognition-letter-tests.yml`. Validates A4 portrait/justified HTML, self-hosted QR source, canonical public URL without visit token, permanent archive footer sentence, scan's original date and paper fields, and nonverified/offline failsafe. **6/6 site markup checks passed** using current GitHub sources.
- Strictly distinguished these mock/source tests from **actual live Heroku/API/GitHub Pages QR scans, browser PDF print-to-A4, and full Node GitHub Actions CI**: production endpoint was not accessible from the assistant's network environment, and no controlled live valid staging record exists. Thus a truly end-to-end browser/database test is still **pending**.
- Checked production MongoDB `recognition_selections` and `recognition_certificates`: both empty at the time of the test. No actual winner, letter or author notification was issued.
- Next acceptance gate: provision a **separate staging backend/database or safely isolated preview fixture** (not a fabricated public winner), run actual Chromium/Safari letter → print A4 → scan QR → historical verification including status changes; test full CI and deployed backend network before considering master activation. Author emails remain disabled.

### Complete published-paper abstract coverage audit — 18 November 2026
User requested checking **other papers containing only short summaries**, beyond the methane-emissions example.
- Direct read-only MongoDB Atlas aggregation of `oilandgas.publications` with `status:'published'` and publication object: **124 records**. Exactly **0** have a non-empty `publication.abstract`; exactly **0** have `publication.abstractSourceVerified===true`.
- **121/124** summaries are under 250 characters; **108/124** under 200 characters; **86/124** under 150 characters; 7 under 100 characters. Mean summary 143.4 characters; min 76, max 360.
- **108** contain a DOI resolver source link; **16** use other original links (publishers, repositories, PDFs, journals). These are source URL categories only; no DOI title/abstract remote retrieval was performed in this audit.
- Category breakdown (total; summary under 250; verified abstract): Other (53;53;0), Reliability (18;15;0), Safety (12;12;0), Measurement (11;11;0), Instrumentation & Control (10;10;0), Energy transition (10;10;0), Digitalisation (8;8;0), Sensors (2;2;0).
- Shortest examples: `OG-P-68261E834F7810DE` kenaf oil-spill removal 76 chars; `OG-P-46ACC49F09443C82` project-time performance Ghana 83; `OG-P-5064FA860178466C` crude-oil price time-series prediction 85; `OG-P-F68E9850BF8240A7` rambutan drilling-fluid filtration 94.
- IMPORTANT: Some non-DOI records use references such as `OG-P-MY...` which **do not match** the current strict `OG-P-[A-F0-9]{16}` eligibility regex. This is a separate eligibility/data-normalization issue; do not silently exclude source-verified Malaysian contributions.
- **No scoring, publication updates, recognition records or emails were performed by the audit.** Next safe step: DOI-first audited abstract enrichment and separate non-DOI publisher/PDF extraction, with conservative manual verification and no false award eligibility.

## Scoring policy switched to existing directory fields — 18 November 2026
- User decision: assess all published research **using only data already in the website**, rather than block all recognition awaiting full source abstracts. Equal treatment and a published explanation of each keyword criterion remain mandatory.
- Implemented `keyword-directory-v3.0` in `server/oilandgas/recognition-rules.js`: six deterministic editorial dimensions, same 100-point weights, graded independent word/phrase groups, exact matched signals, summary-length neutrality, no API/AI, no external full-text claims. Inputs are directory `title`, `summary`, `topic`, `byline`, and `source` only. "Evidence" 15pt is explicitly source/metadata traceability, not verified empirical evidence or journal peer review.
- Updated `recognition-selector.js` to accept mode `rule-based-directory` only with independently cleared source/integrity records; changed the production `recognition.js` reviewer/Friday/Monday score and revision to directory-only, and required matching rubric version. Full abstracts no longer affect scores, source-review revisions or award eligibility. Optional abstract enrichment stays available to editors but was removed from the award scheduler.
- Crossref DOI/title checks can approve bibliographic screening even if Crossref provides **no abstract**; a separate known-retraction lookup must have no explicit notice. Non-DOI sources remain available for documented editor source checks. No inference of peer-reviewed scientific quality is made from these checks.
- Fixed `publicationEligibility` reference pattern so all 16 `OG-P-MYXXXXXXXX` Malaysian publication records are not inadvertently excluded.
- Authenticated admin scorecard now shows the existing-directory scoring for all eligible published papers; updated explanatory copy and public `recognition.html` methodology. Optional abstract import tools grouped below a collapsed admin disclosure panel.
- Read-only MongoDB data audit of published papers: **124 of 124** pass eligibility with corrected ID formats and 124/124 can be scored using existing directory fields (no original abstracts required). Distribution: **0 at ≥85**, **3 at ≥75**, highest score **76**. These are *candidate screening points only*, not approved winners or proof of paper quality. At unchanged thresholds, Editor's Pick category is vacant; up to 2 other categories may become populated after independently cleared source checks.
- New scoring and selection regression files updated; **24/24 isolated source-executed assertions passed** for rules, selector and weekly dry-run; backend syntax passed. Full CI/Heroku live end-to-end activation remains unverified.
- No real recognition selection, letter, author email or admin notice was issued in this task. Master activation flags remain OFF. Next work: confirm deployed backend version, actual source screening of top candidates and real admin/winner rendering (without activating until approved).

### Directory-only threshold and top-ranked research fairness audit — 18 November 2026
User authorized reviewing real paper rankings and determining suitability of thresholds for short-summary scoring, without silently lowering standards.
- Audited entire live directory `oilandgas.publications` (124 published records) using actual title, summary, topic, byline and source and `keyword-directory-v3.0` scorer; no abstract input. Top preliminary candidates originally 76 / 75 / 75, but code inspection found bias: generic "oil and gas" counted as both upstream and midstream; plain "process" counted as downstream; "first" as ordering adverb triggered novelty; plural "sensors" could fail to match.
- Corrected all four keyword issues in `server/oilandgas/recognition-rules.js`, without changing category weights or minimum qualification thresholds. Added explicit regression tests for all four issues.
- **Recomputed distribution after correction:** 124 scored, **0 ≥85**, **2 ≥75**, **6 ≥70**, **13 ≥65**, **29 ≥60**. Highest = 75; category means remain uneven because topic labels and short editorial summaries vary in vocabulary. At currently approved 85-point Editor's Pick threshold, that category remains vacant. The two 75-point sludge-drying titles share an identical four-person byline and closely related titles but have different conference/source records; flag for source-level similarity review before recognizing both. Do not declare them duplicates without examining full originals.
- **28/28 source-executed isolated tests passed** for scoring, selection and workflow; full Node CI/Heroku integration still requires verification.
- Detailed auditable report: `WRRP_DIRECTORY_SCORING_AUDIT_2026-11-18.md` (top papers, matches, categories, score distribution, fairness corrections, and threshold recommendation).
- **No threshold change authorized or deployed.** Leave vacancies rather than inflate scores; if the user later wants frequent winners under short metadata, openly discuss revised thresholds and consequences, not an invisible adjustment.
- No database writes, awards, letters, author/admin emails or master activation. Existing release gates remain OFF.

### Approved score-threshold recalibration — 18 November 2026
- User directed recalibration of the directory-only WRRP system after actual top-paper review.
- **New category minimums: Research Editor's Pick 70/100; Industry Impact 60/100; Emerging Research 60/100.** Previous limits 85/75/75 now superseded. **Weights and `keyword-directory-v3.0` phrase matching unchanged.**
- Based on the fixed 124-paper live directory snapshot, 6 papers score >=70 and 29 score >=60. These are only *preliminary textual candidates*, not source-cleared winners. Alternative comparisons: 75/65 => 2/13; 72/62 => 2/19; 68/58 => 9/34.
- In `recognition-policy.js`, introduced immutable `MINIMUM_SCORE` map and `THRESHOLD_VERSION='directory-thresholds-v2-2026-11-18'`. `recognition.js` guarded automated candidate metadata checks now use the minimum category threshold instead of previous hardcoded 75.
- Frozen Friday preview saves source assessment and threshold versions, exact minimums; Monday activation fails closed if preview versions are stale. Cycle records the policy version so the historical editorial standard is traceable.
- Updated selector, policy and weekly simulation boundary tests; **34/34 source-executed isolated tests passed** across core policy/scoring/selection/weekly simulation; backend JavaScript syntax passed. Full Node CI and real Heroku integration were not verified in this turn.
- Audit appended to `WRRP_DIRECTORY_SCORING_AUDIT_2026-11-18.md`; do not misrepresent this as peer review.
- **No real research award, letter, email, MongoDB write, configuration flag change or programme activation. Master OFF and author congratulations OFF.**

### Source-checked 70/60/60 shortlist dry run — 18 November 2026
- Conducted read-only actual MongoDB 124-publication directory dry run with latest `keyword-directory-v3.0` scorer and 70/60/60 category minimums. `recognition_selections`, `recognition_overrides`, `recognition_rule_reviews` and `recognition_controls` had no records. **Production-qualified winners: ZERO.**
- Provisional dry-run (`verifiedOnly:false`) returned:
  1. Research Editor's Pick: `OG-P-463438DD9AA7645C`, *Processing Capability Improvement Through Parameter Optimization of a Sludge Drying Plant*, 75/100.
  2. Industry Impact: `OG-P-00C378D8ACA439B7`, *Cost Analysis Study Through Optimization of a Sludge Drying Plant for a Petroleum Refinery*, 68/100.
  3. Emerging Research: `OG-P-47A964319ED21BBF`, *Energy Optimisation and Management System for Smart Buildings with IoT and Support Vector Regression-Based Predictive Modelling*, 71/100.
- Externally corroborated first paper in UiTM Shah Alam 2012 IEEE proceedings index; second 2015 ARPN PDF original title and authors; third 2025 i-PACT conference schedule and author ORCID profile. Direct live Crossref/title/retraction API and full source integrity checks NOT yet passed.
- Related work: 2012 UiTM Shah Alam paper and 2012 Bandung ICCSII DOI `10.1109/CCSII.2012.6470467` have the same four authors and near-identical title words, though independently recorded in distinct conference proceedings. Legitimate overlapping versions versus distinct studies **NOT** resolved; do not accuse either of duplication or automatically award both. 2015 cost-analysis paper and several other sludge papers form a related research family; source-level method/results comparison required. The 2025 building energy study requires transparent cross-industry relevance rationale before a claimed oil/gas industry spotlight.
- Created `WRRP_DRY_RUN_SOURCE_REVIEW_2026-11-18.md` with detailed proposal, source URLs, caveats and editorial next actions.
- Added read-only related-publication caution: `server/oilandgas/recognition-related-review.js`, private `GET .../related-review`, Editor's Desk `Related research screening` panel, and 4/4 isolated helper regression checks. Does not automatically disqualify any research and sends no emails.
- No live awards, letter records, preview persistence, MongoDB mutations, author/admin mail or activation changes. Master switch OFF; next step manual source-level comparison and live integration acceptance.

### Resend recognition sender preparation and configuration blocker — 19 November 2026
- User requested configuring `recognition@oilandgas.eu.com` through existing Resend Free account **without intervention**, then sending one test to `m.zurix@oilandgas.eu.com`.
- User-supplied Resend screenshots establish existing membership emails were delivered and **only** `updates.oilandgas.eu.com` is verified. **Parent `oilandgas.eu.com` is NOT shown as verified.** Prior success for update subdomain does not authorize parent-domain sender.
- Available connected tools cover GitHub source but **do not provide an authenticated Resend management action, Namecheap DNS record editor, or Heroku config-var writer**. Plugin discovery did not find Resend or Namecheap DNS connectors. No production provider API key was exposed; do not invent DNS records or assume an API key is available. Therefore account domain creation, DNS verification, actual Heroku secret provision/deployment and live email sending **could not be performed**.
- Prepared isolated backend module `server/oilandgas/recognition-resend-owner-test.js` using official Resend POST `https://api.resend.com/emails`; sender `Oil & Gas Editorial Team <recognition@oilandgas.eu.com>`, fixed recipient/reply-to `m.zurix@oilandgas.eu.com`, idempotency-key requirement, clearly labeled **OWNER TEST — NO AWARDS** body.
- Added authenticated Editor's Desk endpoints `GET /resend-owner-test/readiness` and `POST /resend-owner-test/send` requiring `confirm:'SEND_RESEND_OWNER_TEST_ONLY'`. API requires **dedicated secret** `OIL_RECOGNITION_RESEND_API_KEY` configured in Heroku environment, does not use or change membership sender, has a DB-enforced one-per-24h atomic claim, and never sends to authors. Resend acceptance not treated as proof of inbox delivery. No front-end UI added yet.
- Added four mocked provider tests `tests/oilandgas-recognition-resend-owner-test.test.js` (fixed owner address, idempotency, invalid credentials, rejected provider response). **4/4 passed** in isolated runtime, backend syntax passed. Tests registered in recognition GitHub workflow.
- **Next required access:** Verify `oilandgas.eu.com` domain in the user's Resend account, adding Resend-provided DNS records without changing Hostinger MX or existing update subdomain. Create a dedicated restricted sending API key and supply it via private Heroku environment variable. Confirm deployed backend and run one authenticated owner test; inspect Resend message ID/event and recipient inbox. Until these are done, **zero real Resend test emails have been sent**. Never paste API secrets into GitHub/chat.
- Master awards activation OFF; author congratulation sending remains OFF and not connected to this isolated test.

### User confirmed dedicated Resend key configured — 19 November 2026
- User reported configuring `OIL_RECOGNITION_RESEND_API_KEY` in Heroku after Resend screenshot showed DKIM and both sending CNAMEs verified for `oilandgas.eu.com`. Screenshot confirmed DNS records; it was not a signed authenticated Resend API verification.
- **Authored editor dashboard one-click owner test:** `server/oilandgas/desk/recognition.html` / `recognition.js` now call `GET recognition/resend-owner-test/readiness` on page load, disable button unless configured, and after administrator confirmation `POST recognition/resend-owner-test/send` with `SEND_RESEND_OWNER_TEST_ONLY`. Sent-state text distinguishes Resend acceptance from actual inbox delivery and includes message ID. Fixed To and From remain in `recognition-resend-owner-test.js`. Researcher notifications and recognition release remain OFF.
- Source checks: 9/9 integration wiring assertions, 4/4 mocked Resend API tests, JavaScript syntax pass.
- **No actual API test was transmitted in this assistant turn.** Live Heroku is not accessible through available network/tool connections and no authenticated Heroku administrator session is connected. GitHub code commits do not prove Heroku deployment.
- Owner can open `https://mterm2026-559f9bf571b5.herokuapp.com/api/oilandgas/editor/recognition.html` after sign-in, locate `Resend recognition email — owner-only test`, check configured readiness, press `Send one Resend test to my inbox`, and confirm Resend message status. If not configured/deployed, check Heroku secret and actual deployment. Owner email and only owner email `m.zurix@oilandgas.eu.com`.

### Sample congratulations design email to owner — 19 November 2026
- Owner requested: "ok lets test it to my email" after the corrected sender test confirmed no personal Reply-To.
- Added *fictional, clearly marked* Resend congratulations demo in `server/oilandgas/recognition-resend-owner-test.js`: gold/charcoal editorial HTML, sample category and fake illustrative research title, dated example period, congratulations text, permanent recognition/QR explanation and public archive link. **Never create a fabricated award/certificate, fake QR reference or letter record.** Subject prominently says `[DESIGN TEST — NO AWARDS]`; body repeats that no recognition was issued. Existing sender `recognition@oilandgas.eu.com`; fixed sole recipient `m.zurix@oilandgas.eu.com`; no custom Reply-To, no personal email in body.
- Updated authenticated `POST /resend-owner-test/send` to accept explicit `SEND_RESEND_CONGRATULATIONS_DEMO`, selecting `congratulations-demo` variant, and a separately rate-limited Mongo claim key `congratulations-demo-v1` (24h), without bypassing regular test-lane cooldowns.
- Added button in `server/oilandgas/desk/recognition.html`: **Send sample congratulations email to my inbox**; secured `recognition.js` dashboard calls the fixed-recipient endpoint after explicit confirmation. No author notification workflow or master activation enabled.
- Six/six isolated mocked Resend tests passed including sample payload and rejection of unsupported variant. Backend, sender and dashboard JavaScript parsed successfully.
- **Important:** The user still needs to press the authenticated admin button to initiate the actual live provider send; model has no access to their authenticated Heroku editor session. No actual send claimed in this turn. Verify inbox and Resend event after clicking. Full personal letters/QR require real award records, so do not fake them during this email-design test.
