# Core bundle audit — no qualified candidate

Frozen source: 708f5a9c54d60043f7b06a7d87ea1e8b50f84922. Node 24.22.1; installed Vite 8.3.5 / Terser 5.51.2. Closed 2026-11-14 04:22 UTC.

The audit found no safe, concrete reduction of at least 2 KiB gzip. No patch is proposed. No dependencies, runtime capabilities, public APIs, signatures, budget limits or classifications changed. Shared root source was never edited.

## Baseline and method

The existing Core total is 343,465 bytes against 344,064 (599 bytes margin). Its Vite Core JS subset totals 266,899 bytes; signed worker transport, service worker and public Physics runtimes account for the remaining 76,566. All comparisons use node:zlib gzipSync defaults, matching tools/check-budget.mjs. Vite console estimates use different settings and were not used as the metric.

The build probes use a local archive of the immutable source commit with cloned installed dependencies. All @ardesia workspace symlinks resolve to the isolated packages. ConfigLoader native avoids a shared Vite config cache. Generated public assets were copied from the same baseline. Group/minifier probes rebuild Vite JS only; therefore their figures are subset measurements, not a newly verified whole-Core gate. Filename changes would also change service-worker hashes by a few bytes.

25 complete Vite builds (one baseline and 24 alternatives) plus 7 in-memory recompression variants examined 31 alternatives. The baseline isolated build exactly reproduces the 266,899-byte Vite subset.

## Results

| Family | Best observed delta | Conclusion |
|---|---:|---|
| UTF8 instead of ASCII reprint | +532 B | Worse |
| Six Terser recompression variants on built JS | −283 B | Less than target; not a source build result |
| Initial five complete build alternatives | −61 B | Less than target |
| Fourteen additional chunk-group variants | 0 B | No improvement |
| Four final minifier variants | −127 B | Less than target |
| 127 pure schema-initializer wrappers in eight files | −64 B | Churn not justified; fully restored |

Removing the current foundation group increases the Vite subset by 2,102 bytes. Keeping the existing configuration is the best supported decision. Oxc-only and removing Rolldown minification also worsen the baseline.

## Raw evidence

- probe.mjs / probe.json: Unicode format experiment.
- compress-probe.mjs / compress-probe.json: six existing-Terser recompression variants, per-file results.
- build-probe.mjs / build-probe.json: baseline and five build alternatives, per-file results; build-*.log and dist-* outputs.
- group-probe.mjs / group-probe.json: fourteen grouping alternatives, per-file results; group-*.log.
- final-minifier-probe.mjs / final-minifier-probe.json: four final minifier alternatives.
- pure-probe.mjs / pure-probe-changes.json / pure-build.log: 127 initializer wrappers, no accepted source change. The exact post-build gzip sum measured 266,835 bytes (64 bytes below baseline).
- audit.json: source identity, unchanged limits, and SHA-256 proof that all nine mutated candidate source files were restored to the immutable baseline.

No browser equivalence tests or new full gate were run: none of the alternatives met the minimum improvement for a candidate. Existing test results must not be attributed to these variants. No background processes or servers remain from this audit. No independent approval, commit, push or deployment is claimed.

Further compression would likely require a larger design change or dependency upgrade; neither is supported by this evidence. The audit does not recommend speculative property mangling, pruning KaTeX capabilities, weakening validation, changing signed worker bytes, moving assets out of Core, or inventing another compression transport.
