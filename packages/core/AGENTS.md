# Core ownership

- Owner: Core role. Integrator alone coordinates cross-module changes.
- Public entry point: `src/index.ts`; depend only on public contracts.
- Core alone accepts commands and owns documents, revisions, receipts and events.
- Commit document, event and receipt in one atomic `StorageAdapter.write`.
- A rejected/failed command must leave memory and durable state unchanged.
- Never reset or overwrite an invalid persisted snapshot.
- Clock and ID generator are injected for deterministic tests.
- All returned data is cloned; consumers cannot mutate authority by reference.
- M0 adapter is device-local, single writer, and is not a server authorization boundary.
- No third-party plugin execution or implicit content approval.
