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
