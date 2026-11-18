# WRRP LETTER DESIGN LOCK — v1.0 (16 November 2026)

## User-approved format
The selected recognition document is a **Letter of Recognition**, replacing the certificate as the primary author-facing artifact.

Locked visual basis: user-approved A4 portrait mockup generated in the preceding project conversation. The design is described by:
- A4 portrait (210 × 297 mm), one printed page
- White letterhead with charcoal `oil & gas.` wordmark, orange dot, `KNOWLEDGE • EXPERTISE • EXCHANGE` tagline
- Muted gold horizontal dividers; fine refinery-themed line illustration in top-right
- Ref at top-left, date top-right
- Centered uppercase `LETTER OF RECOGNITION`
- Formal Cambria/Georgia-style serif body, 11–12 pt; **full justification for body paragraphs only**
- Author salutation, named research paper, Editor's Pick / other category and recognition week, concise rationale, archival record and co-author congratulations
- No fabricated human signature. Formal `Editorial Team` signatory until an authorized signature is provided.
- Gold recognition seal, official recognition reference, public verification and orange-gold-charcoal footer
- Printable A4 portrait PDF from browser with colored print backgrounds enabled

## Implementation
- `Zux12/oilandgas-website/letter.html`: print-styled A4 justified letter. Existing `certificate.html?id=` links redirect to the new letter page.
- Browser print > Save as PDF currently; a fully server-generated PDF with formally authenticated QR and authorized signature remains future work.
- Public verification remains `GET /api/oilandgas/recognition/verify/:id` against valid recognition records.

## Private engagement monitoring — not email open tracking
The admin wants to know if a recipient clicked their email link and then loaded the document. The implementation distinguishes:
- **Link requests:** `GET /api/oilandgas/recognition/letter-link/:token` (may be triggered by automated security scanners; not proof of recipient reading or email opening).
- **Letter page loads:** `POST /api/oilandgas/recognition/letter-view` is called after the official letter is successfully verified and rendered in the browser. This is a page-load signal, still not proof the human read the letter.
- **Email delivery:** separate and currently **disabled**; no congratulatory emails have been sent or queued.
- PDF print/save cannot be verified simply from page opening. Do not claim download tracking or inbox reading.

A one-time randomly generated 32-byte opaque token is SHA-256 hashed before database storage in `recognition_letter_links`. The URL token is removed from the browser address bar immediately after landing. No recipient email address is exposed on the public endpoints. Admin-only `GET /recognition/letter-tracking` shows counts and first/last timestamps; `POST /recognition/letter-link/create` generates a private unsent test link only for an already-issued valid recognition letter.

## Operational safety
- No recognition email transport is connected. No email opt-in/consent, SMTP, or sending code added.
- WRRP scheduling and activation remain locked. Do not set `OIL_RECOGNITION_ACTIVATION_ENABLED` or `OIL_RECOGNITION_AUTO`.
- No tracking tokens, letters, or recognitions were created in production by this code change.
- Existing membership and submission emails are untouched.
- Tracking should be disclosed in the privacy notice before author outreach begins, with appropriate retention and user controls.

## Next checks
1. Run Node CI; confirm Heroku deployment and public A4 letter page.
2. Test with an approved, valid mock/staging recognition (not production winner): generate test token, load link, confirm first/last timestamps and the separation between link requests and letter loads.
3. Test document under Chrome/Safari Print → A4 portrait → Save PDF, including justified text and one-page fit; compare against locked visual mockup.
4. Add formally generated signed/verified QR code and authorized signature only once configured.
5. Do not authorize email until user explicitly approves after full testing.

## QR verification implementation — 18 November 2026
- Added a self-hosted MIT-licensed QRCode.js generator to `Zux12/oilandgas-website/vendor/qrcode.min.js`, with the original MIT attribution in `vendor/qrcode-LICENSE.txt`. No external QR-image service receives letter details.
- `letter.html` now places a high-contrast printed QR in the A4 footer only after the individual letter record has returned `valid` from the recognition API. The encoded URL is `https://oilandgas.eu.com/verify-letter.html?id=OG-WRS-...`, containing **only the public unique letter ID**, never private visit tokens or author email details.
- Added `verify-letter.html` with official live verification states: valid, withdrawn, invalid/not-found, unavailable. It displays author, paper, category, issuance date and recognition ID from the server; it **never** treats a failed/offline verification as valid.
- Backend `GET /api/oilandgas/recognition/verify/:id` now resolves status using BOTH the issued letter and its parent recognition. A valid letter with missing, withdrawn or invalid parent is invalid/withdrawn even when the letter record itself was not yet marked withdrawn. Added `recognition-letter-verification.js` for testable fail-closed status logic.
- Added `tests/oilandgas-recognition-qr-verification.test.js` and included it in the recognition GitHub Actions workflow. Ten isolated source checks passed for status outcomes, URL, bundled QR generator and syntax.
- **Remaining independent acceptance:** verify deployed GitHub Pages/Heroku URLs, test scanning from a physical printed A4/PDF in Safari/Chrome and check one-page fit, exercise real database valid/withdrawn/unknown records without creating a public winner, and observe CI completion. No author emails, production awards or activation flags were enabled.
