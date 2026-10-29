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

These tests establish local PostgreSQL and browser evidence. They do not constitute observation of a protected remote deployment, which remains a separate M3 acceptance requirement.
