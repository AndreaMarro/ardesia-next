# LessonOS ownership

- Owner: continuity/projections role; public entry point `src/index.ts`.
- Read the Core event stream and document snapshots; do not create another ledger.
- Projections are pure, deterministic, and rebuildable.
- No storage, identity provider, permissions authority or progress mutations.
- A student projection never promotes a draft or exposes hidden linked objects.
- Changes to publication policy require review by Core and security owners.
