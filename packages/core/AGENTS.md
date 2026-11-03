# Core ownership

- Owner: Core role. Integrator alone coordinates cross-module changes.
- Public entry point: `src/index.ts`; depend only on public contracts.
- Core alone accepts commands and owns documents, revisions, receipts and events.
- Commit document, event and receipt in one atomic `StorageAdapter.write`.
- A rejected/failed command must leave memory and durable state unchanged.
- Never reset or overwrite an invalid persisted snapshot.
- Clock and ID generator are injected for deterministic tests.
- All returned data is cloned; consumers cannot mutate authority by reference.
- The M0 adapter was device-local and single writer. Current M3 composes this Core in the server/PostgreSQL transaction; authenticated identity and transport policy belong to the server, domain invariants to this Core. Do not treat a browser-provided actor as authentication or introduce a second authoritative client Core. See `docs/adr/0005-m3-remote-authority.md` and `docs/START_HERE.md` from repository root.
- No third-party plugin execution or implicit content approval.
