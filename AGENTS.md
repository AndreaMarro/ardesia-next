# Ardesia Next

## Start every execution here

Read `docs/START_HERE.md`, `operations/coordination.json`, then only the applicable scoped AGENTS and procedure in `docs/operations.md`. `node tools/check-operations.mjs --brief` prints the bounded handoff; it does not verify a deployment or accept a milestone. Read the relevant lesson in `docs/lessons.md` before repeating an incident-prone operation. Follow source links instead of reloading the entire legacy history.

Latest explicit user instructions and existing authorization govern actions. Live repository/deployment observations govern current facts; generated acceptance reports govern milestone acceptance. Dated handoffs and legacy documents are historical evidence, not permission or proof for a newer SHA. `docs/history.md` is the single Next execution/decision index; ADRs retain architectural rationale. Do not create a second status engine, RUNLOG, scheduler or knowledge database.

## Execution and authority

Use this repository only. `AndreaMarro/ardesia` is a read-only source, never a deployment target.

- Coordinator owns integration, dependency lock, CI, remote writes and release evidence.
- Claim one file area before editing; never run concurrent writers in the same area.
- One web app; Core owns identity contracts, objects, revisions, authorization, receipts and events.
- LessonOS derives projections from Core events; it has no independent authoritative store.
- Consume other packages through their public `@ardesia/*` exports. No cross-app or private imports.
- No third-party plugin execution, public deployment, paid add-on or data migration without its gate.
- M0's historical baseline was device-only. Current M3 uses remote PostgreSQL; read generated status for acceptance, never infer it from READY or an open browser session.
- Preserve DRAFT, source revisions, licensing and provenance. No auto-approval of content.
- Every PR includes a user-visible result, focused checks, source SHA/digest, limits and rollback.
- Use focused local checks for the actual change and reuse accessible evidence only with its exact identity and scope. Required CI `verify` must run on the final PR head; affected browser flows remain required. Do not repeat a successful identical suite merely because a different agent resumed. `sourceDigest` includes documentation: an earlier report cannot formally accept this new tree. See `docs/operations.md#verification-and-reuse`.
- `npm run status` generates evidence-based state; do not hand-edit generated output.
- Browser tests default to the isolated local database. Remote regression requires explicit staging mode, existing synthetic credentials and approved platform access; its separate report never accepts M3. See `e2e/README.md` and the dated observations in `operations/m3-environment.json`.
- Remote preflight must pass before application login or writes. Use only short-lived project OIDC on the exact staging origin, reject redirects and preserve independent application cookies; never relax protection to make a test pass.
- No external agent/Codex jobs. Roles describe ownership, not a mandate to spawn more workers.

- One active implementation increment, one coordinator for remote writes, and bounded independent analysis/review. An existing ready PR is not a reason to reimplement its result. User-requested governance work may coexist with the already-ready benchmark PR; do not start a third delivery stream.
- Claim task, base SHA, branch and path prefixes before editing. Read current PR head before a remote mutation; update with expected SHA and without force. A claim is coordination metadata, not an access control. A stale claim never authorizes takeover: inspect the remote head and reconcile first.
- During M3 collection preserve main, preview/m3 and staging. Complete isolated PRs without merging ordinary changes into the frozen candidate. Existing release-runbook exceptions require their original evidence and authorization; this document grants no new deployment permission.
- Check an unchanged access blocker at most once per run and retry only after a material capability change. Never mine secrets from chats, logs or browser storage, create bypass links, weaken gates or request repeated owner login to fill a run.
- A separate model review is a technical review, not a separate GitHub identity or human approval. Record reviewer context, exact source and limits. Do not request external reviewers or send messages without authorization.
- Improve instructions only from a verified incident with a reproducible case, regression check, separate review and reversible versioned change. Never let a skill alter its own permissions, scheduler, acceptance definitions or publication authority.
- End with a compact checkpoint (task, read sources, SHA, evidence, blocker delta, next action). If nothing material changed and no safe task is eligible, stop without new comments, commits or repeated tests.

Ownership: `apps/web` UX; `packages/core|contracts` Core; `packages/server` identity/data;
`packages/remote-client` remote continuity; `packages/lesson-os` projections;
`packages/plugin-sdk|plugin-host` plugins; `packages/ui` design system; `e2e` QA;
`tools|.github|operations|package*.json` coordinator. See `docs/handoff.md`.
