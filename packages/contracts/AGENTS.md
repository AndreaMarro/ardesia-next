# Contracts ownership

- Owner: Core/contracts role. Coordinate all public API changes with the integrator.
- Public entry point: `src/index.ts` only; consumers may not import internal files.
- Runtime schemas and inferred TypeScript types are one source of truth.
- Preserve source identity, exact revisions, status, and provenance in every object.
- Breaking persisted-schema changes require a version and an explicit migration.
- No app imports, UI code, storage, authentication providers, or side effects here.
- M0 role values are contracts; the local preview does not authenticate users.
- New capabilities require negative tests in the consuming authority.
