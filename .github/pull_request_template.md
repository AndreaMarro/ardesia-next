## Problem and observable result

Task ID and product criterion/source. What changes for the real consumer? Keep proposed, implemented, tested, deployed and accepted distinct.

## Scope and ownership

- Base / branch / path claim:
- Contract and consumers affected:
- Existing PRs/dependencies reconciled:
- Main/staging freeze and authorization relevant to this change:

## Evidence on the final head

- Exact head SHA and sourceDigest:
- Required CI run, commands and affected browser flow:
- Evidence reused with its identity/scope; reason new tests are needed:
- RED/GREEN or meaningful counterproof where appropriate:
- Review type (author, separate technical review, formal GitHub/human review), reviewer scope and source:
- Deployment/origin/protection/build identity, only if actually observed:
- Known limits, inaccessible artifacts, NOT_RUN/BLOCKED checks:

Historical CI or a green benchmark does not accept a new release or M3. Do not change a source file merely to insert its own commit SHA.

## Recovery and next action

- Files/behavior affected by a revert:
- Snapshot/schema/recovery compatibility and prerequisites, including pending intent export where applicable:
- Data restore status and separate procedure, if relevant:
- One next gate; history/lesson update for a material change:

Do not prescribe a generic redeploy of the previous client: recovery-v2 records require a compatible reader or completed recovery/export. Code rollback does not restore data. No remote migration, reset or production promotion is implied.
