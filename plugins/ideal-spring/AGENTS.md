# First-party ideal spring

Own the scientific model, serializable state, worker and model tests only.
The public export contains metadata and initial state; applications must never import the model or worker directly.
Only the Plugin Host may execute the exact verified, signed worker bundle.
All scientific inputs use SI units, strict finite bounds and an explicit state schema version.
No browser storage, network, DOM, Core imports, content approval or independent event log.
Changes to source require rebuilding and re-signing the distribution through the coordinator.
