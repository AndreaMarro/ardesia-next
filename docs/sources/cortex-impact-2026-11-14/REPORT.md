# Cortex deterministic direct-import experiment — 14 November 2026

**Recommendation: do not promote this into the default Cortex workflow.** Preserve the isolated, tested candidate as an optional investigation tool. It finds direct import/re-export readers with explicit provenance, but this experiment does not show enough benefit over well-formed `rg` searches to justify a new default subsystem. No model, library installation, server, source execution, automatic commit, or automatic test selection was added. Shared repository files were not edited.

## Concrete consumer and result

After the recent Physics importer and Core migration changes, an engineer needs to locate source consumers and tests worth reading. The candidate accepts an admitted target path and optional original imported symbol, then returns direct lexical edges, source lines/hashes, aliases, type-only flags, and coverage/omission metadata. It is a dependency graph, not a call graph, runtime-impact guarantee, causal world model, or replacement for regression coverage.

The useful finding was `tools/build-physics-pack.mjs:9`: it imports `PhysicsImportSchema` using a longer relative path and explicit `.ts` extension. The initial hand-built truth set and frozen `rg` expression both missed that real tenth consumer. The graph found it. This was manually verified against the frozen file, and is recorded separately in `evaluation/adjudication.json`; the frozen protocol and original scores were not rewritten.

A stronger **post-hoc** `rg` expression also finds all ten Physics consumers. This discovery establishes a limited navigation convenience, not a durable precision advantage or token-saving result.

## Frozen experiment

- Protocol SHA-256: `1a9e60203948c4e33462f961469368c593512a86903fcb04355863020b815fc9`.
- 5 development cases, then 5 distinct held-out cases. Expected consumers and `rg` queries were manually inspected before the protocol freeze. Thus “held out” means no result-driven implementation tuning, not an independently authored benchmark.
- Source worktree HEAD at snapshot: `7c9c061f5650d054acc8f4f8f4a53da30812fdcc`; the snapshot includes admitted current working-tree content, not only committed bytes.
- 720 admitted files / 9,297,935 source bytes; 384 entries excluded by existing Cortex rules. Source manifest: `f78fc32f50131c3b96b8ee7c5ba228177c8d6fc79d47074457af65a1bb31045b`.
- Every copied file was hash-checked. The frozen corpus has its own Git repository, preventing concurrent root changes from altering the benchmark.
- Existing TypeScript 5.9.3 parses 327 JS/TS sources. No new library. Existing Node 24 runtime used.
- Implementation and extractor were frozen before held-out execution; no subsequent source tuning. Hashes are in `evaluation/heldout-freeze.json`.
- Three repetitions per case, 30 total; 8,000-byte output budget. No benchmark output was truncated by budget.

| Case | Split | Frozen expected files | Returned module/named files | Additional possible symbol file | Outcome |
|---|---|---:|---:|---:|---|
| Physics import | dev | 9 | 10 | 0 | Real tenth consumer omitted from manual truth set |
| `migrateSnapshotForOpen` | dev | 9 | 9 | 1 | Nine explicit imports; remote-client dynamic module import is only possible |
| learning evidence | dev | 3 | 3 | 0 | Exact |
| Creator ProgramSurface dynamic import | dev | 1 | 1 | 0 | Exact |
| render queue | dev | 3 | 3 | 0 | Exact |
| ink reconciliation | held out | 1 | 1 | 0 | Exact; two edges, one file |
| recording recovery | held out | 2 | 2 | 0 | Exact |
| tutor values | held out | 4 | 4 | 0 | Exact |
| server backup re-export | held out | 1 | 1 | 0 | Exact |
| PDF engine dynamic/type import | held out | 2 | 2 | 0 | Exact; three edges, two files |

The raw frozen scores correctly show the Physics builder as an unexpected result; adjudication identifies it as a true consumer. For the symbol query, including all `possible` rows would add `packages/remote-client/src/index.ts` without evidence that it uses that specific symbol. It is explicitly labelled possible and must not be counted as a confirmed symbol consumer. After the documented Physics truth correction, there are no observed false named/module matches or missing expected direct consumers across these ten cases. This small sample does not establish repository-wide completeness.

## Comparison with rg

`rg -n` used meaningful literal-specifier regexes or the symbol name over the same pre-admitted JS/TS files, not deliberately noisy basenames. Raw results and a comparator excluding the target definition file are both preserved. The frozen raw symbol search has one extra file (the target definition); excluding it produces the same nine named consumers. On the held-out cases, `rg` and the graph return the same distinct files.

| Measurement | Impact candidate | rg |
|---|---:|---:|
| Median warm measured query | 1,183.12 ms | 7.88 ms |
| Graph-cache miss query | 2,344.68 / 2,364.34 ms | — |
| Median output bytes | 2,047 | 380.5 |

These are local observations, not a universal speed ratio: the candidate performs two whole-corpus integrity refreshes even on cache hits, while `rg` receives an already admitted file list and does not provide equivalent hashes/provenance. Graph-cache misses are not cold OS/disk measurements; the existing Cortex text index was prepared before timing. Python function execution is timed for impact and subprocess execution for `rg`. JSON includes structured provenance and warnings; rg output is just matching source lines. Output bytes are not model tokens, and no end-to-end programming time, model cost, cloud use, or token savings were measured.

## Safety and partial coverage

The candidate reuses unchanged Cortex 0.2 (`cortex.py` SHA `aa5c1d5fbd152506fe912641698be0ec426c06b261a41c68350327934a6fb92f`): tracked-file allowlist, secret-text exclusion, symlink refusal, byte/file limits, repo-bound DB, and hashes. Its derived cache is invalidated by corpus/manifest or parser identity changes. It checks sources before parsing, checks the corpus after parsing, rechecks returned sources/target, and verifies the whole corpus again before output. A detected change fails closed and asks for retry. This remains a checked working-tree view, not an atomic filesystem snapshot.

Observed graph coverage: **861 resolved edges, 0 parse-error files, 5 computed dynamic imports omitted, 3 CommonJS constructs unsupported, 14 missing-path references, 519 external or unsupported specifiers**. The last category is largely external dependencies; it must not be interpreted as 519 defects. Unsupported paths are not followed outside the admitted corpus.

Supported resolution is intentionally smaller than TypeScript: simple relative paths, explicit/extensionless/index source candidates, limited JS-to-TS substitutions, and simple workspace root exports. Ambiguities, duplicate package names, conditional/subpath exports, aliases, query-suffix assets, CommonJS, computed imports, JSDoc imports, dotted extensionless names, and transitive symbol propagation remain partial or unsupported. See `tools/cortex/IMPACT.md`. Installed Node/TypeScript tooling and the cache itself must be trusted; this is not a sandbox for malicious binaries or arbitrary cache tampering.

## Verification and deliverable

**25/25 author checks pass**, including multiline aliases/type imports, star/namespace/dynamic distinctions, comments and strings, workspace export changes, duplicate packages, ambiguity, `.js` substitution, directory imports, untracked/secret/CJS/oversized exclusions, symlinks and symlink parents, file deletion, target exclusion, stale selected hashes, cache identity invalidation, same-HEAD content changes, concurrent new incoming edges, malformed syntax reporting, byte budgets, and non-evaluation of source text. Two early failures were incorrect test assumptions that a 1,024-byte metadata budget would be too small; the final fixture actually exceeds that size and confirms fail-closed behavior. The final log is `evaluation/tests.log`.

`candidate.patch` contains only the optional Python CLI, Node AST extractor, and usage/limitations documentation. It does not modify Cortex baseline or application files. `git apply --check` passes against the frozen corpus. No independent review is claimed. The copied baseline, frozen corpus, benchmark scripts, raw outputs, and author tests remain local evidence, not application changes.

Patch SHA-256: `5d2a52029cd12dc94be248286ff7c3ef8360a4837d62dbc0a927a7cbf14799d4`.

**Integration decision remains with root. Suggested decision: retain the experiment and its negative default-promotion result; use rg/Cortex 0.2 for normal work.** Revisit only for a concrete repeated consumer who values direct module resolution plus provenance enough to absorb the latency and maintenance cost. No background activity or server remains running.
