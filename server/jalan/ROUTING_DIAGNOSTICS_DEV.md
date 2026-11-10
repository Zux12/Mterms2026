# Jalan routing diagnostics — isolated Mterms2026 integration

This integration is committed only to `dev/jalan-routing-diagnostics`.
It reuses the existing Node.js Express process, Mongoose connection, and
`jalan_navigation` database in the Cryptoloop Atlas project. No new Heroku app.

Endpoints (after a reviewed deployment):
- `GET /api/jalan/routing-diagnostics/health` — metadata, no secrets.
- `POST /api/jalan/routing-diagnostics/records` — authenticated test diagnostics.

**Not deployed.** No credentials are included in GitHub. No automatic public
deployment or frontend connection is enabled. The new endpoint requires a
server-side `JALAN_DIAGNOSTICS_TOKEN` (32+ characters); if unset, writes return
401. Never expose this token in the public Jalan browser frontend. Existing
MTERM2026_DB_URI may be reused for this Node.js process; the separate
`jalan_backend` database user is not required unless credentials are deliberately
switched by an operator.

Validation limits data to non-identifying experiment identifiers, graph node
IDs, modeled time, snap distance, reachability, and short notes. It does not
accept GPS coordinates or device/user identifiers.

Before any Heroku deployment: run `node --check server/jalan/routing-diagnostics.js`,
`node --check server/jalan/routes.js`, and
`node server/jalan/routing-diagnostics.test.js`; review existing test suites,
Heroku resource budget, permissions, and rollback. Never deploy this
development branch into production without explicit approval.

The Python routing graph is **not** hosted on Heroku; this work only prepares
diagnostic storage. Traffic and road-matching modules remain unchanged.
