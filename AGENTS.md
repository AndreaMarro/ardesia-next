# Ardesia Next

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
- Run `npm run verify`, then the affected browser flow. CI must verify the precise PR head.
- `npm run status` generates evidence-based state; do not hand-edit generated output.
- Browser tests default to the isolated local database. Remote regression requires explicit staging mode, existing synthetic credentials and approved platform access; its separate report never accepts M3. See `e2e/README.md` and the dated observations in `operations/m3-environment.json`.
- Remote preflight must pass before application login or writes. Use only short-lived project OIDC on the exact staging origin, reject redirects and preserve independent application cookies; never relax protection to make a test pass.
- No external agent/Codex jobs. Roles describe ownership, not a mandate to spawn more workers.

Ownership: `apps/web` UX; `packages/core|contracts` Core; `packages/lesson-os` continuity;
`packages/plugin-sdk|plugin-host` plugins; `packages/ui` design system; `e2e` QA;
`tools|.github|operations|package*.json` coordinator. See `docs/handoff.md`.
