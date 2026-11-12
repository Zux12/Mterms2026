# JALAN KL isolated pilot — operator runbook

**Status:** diagnostic preview only; **not** legal or traffic-aware driving guidance.

## Verified in CI

The read-only loopback HTTP smoke test passed on 12 November 2026 (Actions run 43217961812). It served the preview HTML, rejected unauthenticated health requests, verified the 168,221-edge graph, and returned the expected 17 m public-OSM-node smoke route. This is **not** browser automation, independent road legality validation, or a public deployment.

## Start an owner-only pilot

Run from the repository root on a trusted computer with Node.js 20 and dependencies installed. Supply the dedicated read-only Atlas connection and a newly generated random secret through **local environment variables or a private secrets manager**. Never paste either into chat, a repository, a URL, a screenshot or logs.

Required variables:
- `JALAN_READONLY_MONGODB_URI`: dedicated read-only MongoDB connection.
- `JALAN_PREVIEW_TOKEN`: random secret of at least 24 characters.
- `JALAN_PREVIEW_PORT` (optional): local TCP port, default 8765.

Run `node server/jalan/run-kl-preview-local.js` and open `http://127.0.0.1:8765/` **on the same computer**. Enter the local token in the password field, click **Check graph connection**, then select map points or enter KL coordinates and click **Preview route**.

The server binds only to `127.0.0.1`. It is not accessible remotely and must not be exposed by port forwarding, a reverse proxy, Heroku, or a public tunnel. The browser loads Leaflet from a third-party CDN and OpenStreetMap tiles from an external service; avoid private coordinates in the pilot.

## Known limitations and release gates

- Graph import: 168,221 directed edges; turn import: 1,941 restrictions, none independently verified for enforcement.
- Preview routes do **not** enforce turn, vehicle-access, permit, or conditional restrictions and are not traffic-aware.
- Route ETA is illustrative, using a fixed assumed speed; never treat it as a driving ETA.
- Automated HTTP smoke verifies the API contract, not a real browser's JavaScript rendering.
- The loopback pilot permits one in-flight route calculation at a time; overlapping requests return HTTP 429. This is a local resource guard, not production-grade distributed rate limiting.\n- The 20 independently reviewed KL journey acceptance gate remains incomplete.
- Do not connect this preview to production MTERMS2026 or live TomTom routing.

## Before any external pilot deployment

Separate app and database credentials, read-only database role, authentication, HTTPS, rate limiting, logging without coordinates/secrets, dependency pinning and CSP hardening, health/route verification, explicit diagnostic-only labels, and independent road safety review are required. Keep the current owner-only loopback version as the safe default.
