# Browser evidence for M3

The browser suite uses the real `/api/m3` handler and an isolated PostgreSQL database. `fixtures.ts` logs in with synthetic credentials supplied by the runner, creates a unique workspace through the API, and creates the original sample lesson through authenticated Core commands. It reuses one teacher session per worker in otherwise isolated browser contexts, so regression coverage does not bypass or exhaust the production login rate limiter.

The browser never receives the authoritative workspace snapshot. Assertions use the authorized `export-personal` projection; receipt assertions inspect the actual command response. New student contexts in the M3 continuity scenario start with no cookies, storage, or projection and perform the application login form themselves.

## Preserved M0–M2 scenarios

The 51 existing project/scenario combinations retain their names, including the `[M1]` and `[M2]` identifiers used by release evidence. The following probes change at the remote authority boundary:

| Earlier local probe | M3 probe and retained refusal |
| --- | --- |
| Read the Core snapshot from localStorage | Read only the authenticated personal export, including documents, revisions, events and installations belonging to that account. |
| Reopen a corrupted authoritative local snapshot | Submit the corrupted legacy bytes to the real import endpoint; require explicit rejection, unchanged original browser bytes and unchanged server projection. |
| Corrupt a saved scientific payload in localStorage | Alter the payload of an actual authenticated read in transit; require the Host to refuse the state and disable save while the authoritative experiment remains unchanged. |
| Force localStorage persistence to fail | Abort the real plugin command request before delivery; require a network error and retained installation, consent and experiment. A separate M3 scenario loses the response after a successful commit and proves safe retry. |
| Notify another tab through local storage | Disable the module through an independent browser tab and real API transaction; require runtime termination, disabled save, and rejection of an old installation revision. Hold an actual activation request during a competing activation/disable transaction and require `REVISION_CONFLICT`. |
| Download a whole device snapshot | Download the account-scoped personal export. Server receipts and other accounts' aggregates are not exposed. |

No successful API mutation is mocked. Tamper probes modify actual fetched catalog, artifact, or read-projection responses. The lost-response test commits through the real server before discarding its response.

## M3 scenarios

All three scenarios in `remote-continuity.spec.ts` run on both `desktop-chromium` and `mobile-chromium`, without skips or retries:

- `[M3] teacher and two students preserve private laboratory work across independent sessions`: teacher authors a lesson and assigns it; A grants personal release consent, saves scientific state, notes and an attempt, explicitly shares evidence, logs out, and recovers the exact work from a fresh session. B is denied before assignment and sees only its own empty work after assignment. Forged student identity and teacher commands are rejected; consent and assignment revocation preserve saved work and remove access. Switching accounts in one browser does not expose A's data to B.
- `[M3] a lost response is recovered by the same command without duplicate revisions or events`: a confirmed database mutation loses its first response. The UI retains an unconfirmed command; retry sends the identical command ID and receives the original receipt without another revision or event.
- `[M3] concurrent authenticated writes reject an old revision and preserve the winner`: two writes with the same expected revision race through real transactions; exactly one commits, one receives `REVISION_CONFLICT`, and retrying the winner returns its original receipt.

## Local and remote targets

`e2e/target.ts` owns the origin used by the Playwright configuration and the API fixtures. The default is `local`, using `http://127.0.0.1:4173` (or an explicit local `PORT`). The local runner still requires a fresh verified build and seeds only its dedicated loopback browser database. CI explicitly selects this mode.

A remote regression is an explicit operation against the existing stable staging:

```sh
ARDESIA_E2E_MODE=remote \
ARDESIA_E2E_BASE_URL=https://ardesia-next-staging.vercel.app \
npm run test:e2e
```

Before running it, verify the deployment SHA/digest and authorize the synthetic data writes. Supply the existing `ARDESIA_E2E_TEACHER_USERNAME`, `ARDESIA_E2E_TEACHER_PASSWORD`, `ARDESIA_E2E_STUDENT_A_USERNAME`, `ARDESIA_E2E_STUDENT_A_PASSWORD`, `ARDESIA_E2E_STUDENT_B_USERNAME` and `ARDESIA_E2E_STUDENT_B_PASSWORD` through the approved secret environment. All three accounts must be distinct. Passwords are never generated in remote mode, no local server starts, and database/operator credentials are removed from the browser child environment. Each scenario creates its own synthetic workspace through the real API; it does not migrate, provision accounts, reset, restore or delete the remote database.

The runner rejects production/other origins, URL credentials, paths, query parameters (including bypass links), local seeding in remote mode, and CLI overrides of configuration/report/output. Remote trace/UI/debug options and diagnostic environment overrides are refused so synthetic login credentials cannot enter a trace or API debug log. It runs only the three M3 continuity scenarios, on both existing browser projects. Remote JSON and screenshots are confined to `artifacts/remote-continuity/`; the four acceptance input files are never overwritten by this mode.

Platform access uses a short-lived `VERCEL_OIDC_TOKEN` issued to the existing project. Obtain it through an already authorized Vercel execution environment or the linked CLI (`vercel env run`); do not paste a token into a command, URL, source file or report. A dashboard session in another browser is not inherited by fresh Playwright contexts. The transport sends `x-vercel-trusted-oidc-idp-token` only on the exact staging origin, disables automatic redirects/retries and normalizes driver errors without call logs. It creates no shareable links and changes no protection or Trusted Sources settings. Application cookies remain independent for the teacher and students. The initial empty-context assertion is made before platform requests can set any cookies.

Before any browser process is launched, `tools/remote-preflight.mjs` compares the real build-info to the checkout identity, verifies anonymous protection, checks PostgreSQL health and probes the application session/Origin contract without an application cookie or password. It rereads build-info at the end. Any mismatch, unconfigured database, unexpected redirect, HTML response, invalid/oversized JSON or timeout blocks login and workspace creation. Playwright's remote global setup performs the same fresh check before its fixtures, covering direct invocation. Successful browser runs must also pass a final preflight before their regression summary can pass. The coordinator still verifies the CI and Vercel deployment ID separately: build-info alone does not prove them.

The preflight can be run alone without application passwords, from the exact verified/deployed checkout and an authorized Vercel environment:

```sh
ARDESIA_E2E_MODE=remote \
ARDESIA_E2E_BASE_URL=https://ardesia-next-staging.vercel.app \
vercel env run -- node tools/remote-preflight.mjs
```

The CLI prints only the sanitized observation report, which is also saved in `artifacts/remote-continuity/preflight.json`. It never follows a protection redirect, prints a nonce, logs a token or writes acceptance input files. The report is a deployment preflight, not remote M3 acceptance.

Remote invocation safety is checked both by the wrapper and while loading the Playwright configuration, before Playwright can clean an output directory. Active trace/UI/debug and reporter/output overrides are refused. `VERCEL_TOKEN`, database/operator credentials and `NODE_OPTIONS` are removed from the browser child. Service workers are blocked so they cannot bypass request interception. Automatic `error-context.md` generation is disabled in remote mode because its DOM snapshot may include password field values; failure screenshots retain the browser's password masking. Login errors are normalized and the password field is cleared on failure.

The remote summary is explicitly `kind: ardesia-remote-continuity-regression`, distinguishes `testSource` from deployment identity, links preflight/postflight digests and reports `m3Acceptance: NOT_EVALUATED`. A partial selection, failed process, absent report, skipped/flaky test, missing required desktop/mobile scenario or failed final preflight cannot pass the remote suite. It does not produce `m3-remote-evidence.json` or assert that the Vercel deployment identity was verified. The test report, preflight, postflight and screenshots remain confined to `artifacts/remote-continuity/`.

The full remote M3 acceptance gate is unchanged. These three regression scenarios do not supply all twelve counterproofs required by `tools/m3-evidence.mjs`, including operator-controlled expiry, outage, backup/restore and import. Only a complete set of observed evidence on the deployed revision can close M3.

## Full acceptance producer

`node tools/m3-acceptance.mjs` is distinct from `npm run test:e2e`. It requires the same authorized staging OIDC and existing three synthetic identities, successful local evidence and protected release metadata for the exact checkout. It refuses diagnostic overrides before launching a browser; the Chromium child receives no application, database or platform credentials in its environment. Four empty browser contexts independently sign in as teacher, A1, B and A2; A1 logs out before A2 starts. The collector observes IDOR, assignment and consent revocation, lost-response retry with the identical payload/receipt, conflict refusal, logout, account-switch refusal and private/shared teacher evidence. Scientific parameters, notes, IDs and revisions are compared across the two A sessions.

The coordinator supplies independently observed Vercel metadata in `artifacts/m3-acceptance/platform-before.json` and `platform-after.json`, or their `ARDESIA_QA_PLATFORM_BEFORE_FILE` / `ARDESIA_QA_PLATFORM_AFTER_FILE` equivalents. Both contain commit, sourceDigest, deploymentId, projectId, canonical staging URL, READY status and observedAt. The latter observation must occur after postflight. A stale file or deployment change refuses acceptance. Preflight and postflight reread the actual deployed build and PostgreSQL health; metadata files do not replace those network observations.

Privileged probes additionally require `ARDESIA_QA_OPERATOR_DATABASE_URL`, `ARDESIA_QA_RESTORE_DATABASE_URL` and the independently verified `ARDESIA_QA_RESTORE_RESOURCE_HASH` (SHA-256 of `hostname:port/database`, without credentials). The source connection is read-only. The restore target must already exist, be migrated, contain zero accounts and zero workspaces, have a distinct database name and match the authorized hash. The collector refuses unknown source accounts: all source accounts and student references must belong to the three observed synthetic identities. It provisions fresh credentials only in the empty restore target, then verifies real backup/restore, a session expiry, failure of an isolated handler's PostgreSQL connection, recovery, and real v1/v2/v3 imports. It never creates databases, rotates existing passwords, interrupts shared staging or overwrites a populated restore target. The operator report explicitly records the isolated execution scope. It preserves original receipt history; a v3 device installation must lose its active consent through the real importer. Source fixtures are explicitly authored synthetic legacy bytes, not remote observations.

Reports stay under `artifacts/m3-acceptance/`. Missing operator access or final platform observations yield incomplete evidence. Only the unchanged twelve-counterproof gate can produce `candidate.json`; it contains the coupled remote/release evidence for explicit coordinator promotion. This command never overwrites local verification, regression reports or release inputs. A complete candidate is still bound to one SHA/digest and deployment; do not move staging while collecting it.

The ordinary unprivileged CI validates the producer with contract fixtures, two loopback-only operator databases and the real browser collector on loopback. These reports explicitly say `NOT_EVALUATED` for remote acceptance. No staging/operator/production secrets are available to this `pull_request` workflow.

## Controlled scalability measurement

`node tools/benchmark.mjs` accepts only `M3_BENCHMARK_DATABASE_URL` for the exact loopback database `ardesia_m3_benchmark`. It refuses an existing workspace schema instead of resetting data. CI provisions that disposable database. Authenticated commands use a restricted runtime role and the real PostgreSQL/Core path, measuring snapshots with 8/32/128 strokes and 1/8/24 assigned students, reopen latency, LessonOS projection reconstruction, command p50/p95, same-workspace conflicts and independent-workspace commands. Pool and database connection/lock waiters are sampled. `artifacts/benchmark.json` records sample counts, snapshot bytes, percentile method and limits. The small CI workload excludes HTTP/TLS/browser rendering and establishes no production capacity claim. No extra performance pipeline or remote benchmark is enabled.
