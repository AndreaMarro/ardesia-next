# Independent Cortex 0.2 review

Reviewed raw `cortex.patch`, original implementation/tests, candidate implementation/tests, evaluator, README, delivery report, and raw `comparison.json`. Independent reviewer `/root/deadline_guard`; no shared source mutation or publication.

Candidate cortex.py SHA256: `0d2f60d4f2f2a0d8fcb2646e968e656d93af52c370514974040efbe766e3e7f2`. Applied the patch to scratch copies and verified all four resulting hashes against patch-manifest.json; base hashes also match the current repository. Receipts: `hash-validation.json`, `applied-hashes.json`.

**No P1/P2 safety regression found in this delta.** Git-bounded paths, no-follow component reads, full UTF-8/secret checks, transactional refresh, source hash recheck, private DB permissions and no repository-text execution are unchanged. Added ranking operates on a bounded pool. The snippet uses complete original source lines and counts the same evidence header/body bytes against both local/global caps. An old0.1database fails closed; no silent incompatible reuse. These observations are scoped review, not a comprehensive security certification of the pre-existing tool.

Executed24/24candidate unittest successfully in1.574s (log preserved). Independent scratch probes passed byte limits256/300/500/1800/8000/100000, exact original lines and hashes, per-snippet1800byte cap, and old-schema rejection. Sources and scripts in `probes.py`/`probes.json`.

## Nonblocking retrieval finding

An unaccented Italian query can match FTS but miss the focus anchor. SQLite unicode61 matches `quantita` against `quantità`; Python regex in `focused_evidence` does not remove accents. With the matching line31 and budget300, the result contains only irrelevant introductory lines1–5. Reproduction is in probes.json. Normalize Unicode accents for **matching/ranking only**, preserving original line bytes and hashes, or document this additional mismatch explicitly. Add an ASCII-query/accented-source regression case. This affects evidence usefulness, not fail-closed provenance.

## Metrics

Recomputed totals from raw rows: expected-file hits7/10→10/10; declaration-in-expected-file hits4/8→8/8. Evidence byte accounting, first-file fields and8000byte budgets agree. Both runs record the same fixture manifest as the origin: `7b23c804ae871f1968e58448703fce6e2bf5806bec9a1fbd118a379dc8dda2de`. Validation receipt: `metrics-validation.json`.

The frozen corpus has been deleted, so I did not independently rerun the exact ten-query benchmark from its complete original bytes; this review verifies the supplied report’s internal accounting and implementation identities. A new run against a changed worktree would be different evidence. The stated limits are appropriate: hand-selected localization cases, no speedup inference, no measured cloud token/cost saving, no patch-correctness claim. Definition regex is heuristic and the candidate pool is not exhaustive.
