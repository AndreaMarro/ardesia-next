---
name: ardesia-sequential-learning
description: "Use when a verified incident, repeated failure or measured redundant work warrants improving Ardesia procedures or skills; not for routine refactoring."
---

# ardesia-sequential-learning

## Inputs
Read one reproduced incident, its exact source/evidence and the relevant docs/lessons.md entry. Separate observed symptom, verified cause and hypothesis. Do not start this workflow for an ordinary refactor or an unchanged external blocker.

## Procedure
Propose the minimum change to the existing procedure/helper. Supply a failing scenario, a valid path and a counterexample preserving the invariant. Use a non-author context on raw inputs, then checks of the final revision. Prefer deterministic tested scripts to repeated prose. Preserve the history and all FAIL/NOT_RUN results.

## Output and errors
Return one bounded proposal with source refs, discriminating proof, independent review, explicit adoption point and rollback. Correct obsolete instructions without deleting historical v1 behavior. An isolated proposal remains unadopted while another claim is active. Unexecuted agent evaluations remain NOT_RUN; tests of fixtures are not real agent or product runs.

## Proof
Use original incident artifacts plus focused regression checks and required same-source CI. Adoption must name previous/new procedure refs and preserve current ownership. Do not change schedule, model, permissions, costs, mission, gates or publication authority. Keep non-blocking analysis within ten minutes and return to product work; at most one method proposal per cycle unless the method is unsafe.
