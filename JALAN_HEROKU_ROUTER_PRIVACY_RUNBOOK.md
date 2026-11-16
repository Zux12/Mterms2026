# JALAN Heroku router query privacy — manual operation

This procedure enables only `http-router-no-log-query`, on one existing Heroku app per run. It does not deploy code, change config vars, fetch location/log records, or write database data. Registration and source integration do not mean the feature is enabled. Default `apply=false` performs GET requests only.

## Before a live run

1. Verify the current trusted `jalan-v4102-routing-regression-tests` head and its completed CI, including the 13 mocked operator cases. Review [PR #69](https://github.com/Zux12/Mterms2026/pull/69). Do not select a draft or arbitrary branch.
2. In the authorized Heroku account, independently identify the intended app and its UUID using authenticated app metadata (`GET /apps/{app-name}`). Keep credentials locally; do not put them into GitHub inputs, comments or chat. `expected_app_id` is the app UUID, never an API token. The established `HEROKU_API_KEY` repository secret is used by the trusted workflow only.
3. Select exactly one role: `private` means `jalan-kl-private-pilot`; `original` means the uniquely existing `mterm2026` or `mterms2026`. If both original aliases exist, the helper refuses the operation. A matching name with a different UUID is also refused.

## Inspect, then enable

Open [the router privacy workflow](https://github.com/Zux12/Mterms2026/actions/workflows/jalan-heroku-router-privacy-operator.yml) and choose **Run workflow**.

| Input | Read-only inspection | Activation |
|---|---|---|
| Branch | `jalan-v4102-routing-regression-tests` | Same reviewed trusted ref |
| `app_target` | One verified app role | Same app role |
| `expected_app_id` | Independently checked app UUID | Same independently checked UUID, required |
| `apply` | `false` | `true` |
| `confirmation` | Empty | `ENABLE_QUERY_REDACTION_PRIVATE` or `ENABLE_QUERY_REDACTION_ORIGINAL`, matching the role |

Inspect the completed dry-run result before activation: `identityPinned=true`, no change, and the observed before/after booleans. Check the source head has not changed before activation. Main only prints instructions; it cannot perform the operation.

Activation checks identity again, obtains the feature ETag, PATCHes only `{enabled:true}` if necessary, and performs another GET. A different UUID, ambiguous name, missing ETag, HTTP 412 or unsuccessful verification stops the operation. Already enabled is a verified no-op. Any failure is unresolved until a new read confirms the state; a failed run after PATCH does not prove no change occurred. Do not blindly retry a conflict or relax the identity checks.

Success must show a completed trusted run with `identityPinned=true` and `after=true`. Record its actual run URL, source SHA, role and observed booleans in the master handover. Repeat independently for the other app if required; one success does not cover both.

## What stays open

Router-query redaction affects future router logs; it does not erase historical logs or establish application, Logplex, drain, analytics or provider retention. Keep public coordinate-GET controls paused until their separate compatibility/privacy gate is satisfied. N11 is not wholly complete after this flag alone. Private POST/CSP/GPS deployment, actual rollback, independent 20-journey acceptance and formal phone readiness remain separate gates. Do not dispatch a code release as part of this procedure.

Heroku references: [Platform API identity and conditional requests](https://devcenter.heroku.com/articles/platform-api-reference), [router logging](https://devcenter.heroku.com/articles/http-routing).
