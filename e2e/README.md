# Browser evidence for the remote UI integration

The browser suite uses the real `/api/m3` handler and an isolated PostgreSQL database. `fixtures.ts` logs in with synthetic credentials supplied by the runner, creates a unique workspace through the API, and creates the original sample lesson through authenticated Core commands. It reuses one teacher session per worker in otherwise isolated browser contexts, so regression coverage does not bypass or exhaust the production login rate limiter.

The browser never receives the authoritative workspace snapshot. Assertions use the authorized `export-personal` projection; receipt assertions inspect the actual command response. Student editor tests use an independently authenticated context and two pages to exercise competing personal drafts.

## Preserved M0–M2 scenarios

The 51 existing project/scenario combinations retain their names, including the `[M1]` and `[M2]` identifiers used by release evidence. The following probes change at the remote authority boundary:

| Earlier local probe | M3 probe and retained refusal |
| --- | --- |
| Read the Core snapshot from localStorage | Read only the authenticated personal export, including documents, revisions, events and installations belonging to that account. |
| Reopen a corrupted authoritative local snapshot | Submit the corrupted legacy bytes to the real import endpoint; require explicit rejection, unchanged original browser bytes and unchanged server projection. |
| Corrupt a saved scientific payload in localStorage | Alter the payload of an actual authenticated read in transit; require the Host to refuse the state and disable save while the authoritative experiment remains unchanged. |
| Force localStorage persistence to fail | Abort the real plugin command request before delivery; require a network error and retained installation, consent and experiment. The transport's unit suite separately covers uncertain outcomes and immutable retry; the full browser recovery scenario is reserved for PR4. |
| Notify another tab through local storage | Disable the module through an independent browser tab and real API transaction; require runtime termination, disabled save, and rejection of an old installation revision. Hold an actual activation request during a competing activation/disable transaction and require `REVISION_CONFLICT`. |
| Download a whole device snapshot | Download the account-scoped personal export. Server receipts and other accounts' aggregates are not exposed. |

No successful API mutation is mocked. Tamper probes modify actual fetched catalog, artifact, or read-projection responses.

## Concurrent editor scenarios

All three scenarios in `editor-concurrency.spec.ts` run on both `desktop-chromium` and `mobile-chromium`, bringing this stage to 57 project/scenario combinations, without skips or retries:

- A teacher note retains its draft and original base after a competing save, accepts an unrelated object update, and remains available to copy after remote removal. Conflicted form submission sends no command.
- A teacher laboratory retains dirty parameters after a competing save and consent withdrawal. Reauthorization starts a Worker; remote removal stops that active Worker while keeping the local draft until explicit discard.
- Student notes compare their own confirmed text without treating unrelated work revisions as conflicts. The first personal laboratory state is detected even when its revision equals the original lesson revision, and its scientific card agrees with the editor. Consent revocation stops execution, retains the draft and requires fresh consent after explicit restore.

These tests establish local PostgreSQL and browser evidence for the integrated consumer. The complete teacher/two-student continuity, lost-response and concurrent-command browser scenarios, plus the M3 acceptance gates, are reserved for PR4. Observation of a protected remote deployment remains a separate acceptance requirement.
