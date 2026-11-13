# KL pilot — controlled deployment readiness gate

**Current decision: HOLD — no public deployment.** The real Chromium-to-read-only-graph test passed on [GitHub Actions run 43242572050](https://github.com/Zux12/Mterms2026/actions/runs/43242572050). This proves a narrow public-OSM-node route in an isolated CI environment, not safe navigation.

## Ready for an owner-operated loopback pilot

- [x] Dedicated read-only Atlas connection supported.
- [x] Owner-provided random preview token required for route and health API.
- [x] Server binds to 127.0.0.1 only.
- [x] 168,221 directed graph edges validated in CI.
- [x] Browser map interactions and real read-only route rendering validated.
- [x] One active route at a time; 12 requests/minute local throttle.
- [x] No DB writes, no production routing activation.

## Required before any externally reachable pilot

- [ ] Separate test app/service with isolated credentials and no production MTERMS2026 code-path changes.
- [ ] HTTPS, authenticated access for every page and API, and secrets management.
- [ ] Route-specific request quotas, timeout, concurrency controls, monitoring and safe error handling.
- [ ] Pin Leaflet and map assets; review third-party CDN exposure and browser CSP.
- [ ] Validate database user has read-only permissions, including denial of writes.
- [ ] Demonstrate safe fallback on database outage, route failure, or missing turn records.
- [ ] Independent road-safety review, with a conspicuous **not for live driving** restriction.
- [ ] Verify 20 independent KL journey cases and compare with a trusted routing reference before any driver-facing navigation release.

## Deployment boundary

Do not deploy this branch into the existing MTERMS2026 production service or merge the draft PR as a shortcut. This checklist is a decision record; it does not authorize deployment or verify that the missing requirements are met.

Next engineering milestone: create an **isolated, private test deployment** only after service isolation and access controls can be demonstrated. Do not expose the current loopback preview through a public tunnel or reverse proxy.

## CI milestone — 12 November 2026

Real Chromium against the read-only imported KL graph has passed for both the short public-node route and a longer corridor route (Actions run 43244573738). This validates a narrow browser-to-backend flow only. Public deployment remains on hold because authentication, operational isolation, legal access and independent journey acceptance have not been demonstrated in an externally reachable environment.

## Automated private deployment preflight

Run `node server/jalan/kl-private-deployment-preflight.js /path/to/private-checklist.json` with a locally maintained checklist. The preflight fails closed (exit 2) if any declared security/isolation gate is absent. Its checks are **self-declared configuration assertions**; they are not independent infrastructure verification. Never put secrets, private hostnames, credentials, or private journey coordinates into the checklist or repository. A passing result never authorizes public driving directions or a production deployment.

## Hosting decision — Railway isolated pilot

Railway has been selected as a candidate for a **separate private test environment**. Provisioning is **blocked until the owner connects Railway** and the actual environment can be inspected. Do not claim that a Railway app, access policy, deployment, or read-only database connection exists until verified. Do not reuse the MTERMS2026 production application, its environment variables, or its write-enabled credentials. The existing loopback-only preview must not be exposed directly. Public navigation remains prohibited.
