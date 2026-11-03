# Server identity and data ownership

- Owner: identity/data role; coordinator owns shared contracts, migrations and release.
- Read root AGENTS, `docs/adr/0005-m3-remote-authority.md`, this package README and the relevant lesson before editing.
- Compose the existing Core through public exports. Derive the actor from the verified application session; never trust a browser-selected role or an operational platform token.
- Preserve ownership, CSRF/origin checks, command identity, expected revision and atomic snapshot/event/receipt commit. Return success only after commit.
- Runtime credentials cannot administer schema, accounts or roles. Operator credentials never enter the browser or deployed runtime.
- Keep one PostgreSQL authority. LessonOS, plugin and future MCP adapters must use authorized Core operations/projections; no direct parallel write path.
- Test real PostgreSQL behavior when changing transactions/auth/restore; use isolated loopback fixtures. No implicit remote test or synthetic credential logging.
- A restore refuses a nonempty target. Never reset a remote database, disable TLS verification or disrupt shared staging to produce evidence.
- Preserve original import bytes and compatibility of snapshots/recovery; code rollback is not data restoration.
