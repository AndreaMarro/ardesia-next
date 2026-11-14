# Independent scientific/editorial review — Physics A

Reviewer: `/root/deadline_guard`, independent agent context. Sources read: all 31 prompts, 105 alternatives and feedback, ten completion answer sets, all explanations and recovery hints; `verify_exam.py`; the current cloud audit and raw institutional source registry. This is AI scientific/editorial review, not human approval, learner calibration or originality certification.

Exam SHA256 `4750b7e1395e11cb86fe7300202642ea0203aee352ddad46cf0d6e189a00740d`.
Verifier SHA256 `39d98a0cd6f341b3e52a2c9402ae0e2d1ca5b08b866dcd6137d9860ce882284e`.

All 21 answer keys and all ten numerical completion values agree with recalculation under the stated textbook models. Detailed key/numeric evidence: `checks.json`. Exam metadata agrees with the institutional rules recorded by the cloud audit: 31 questions, 21 single-choice/10 completion, 50 minutes, +1/−0.1/0. I did not substitute the different 2025 format.

## Required editorial corrections

- **Q14, title (P2):** “Compressione e raffreddamento insieme” equates heat rejection with cooling. The stated balance is ΔU=+40 J; for an ideal gas this means increasing temperature, despite heat leaving. For a generic gas, no temperature conclusion follows from the information. Change to **“Compressione con cessione di calore”**. The prompt, correct key A and calculation are correct.
- **Q21, feedback C (P2):** The alternative says image at **30 cm**, same height. Feedback says “Questo si avrebbe con l’oggetto a 2f, cioè 20 cm”. At p=20 cm, q is also **20 cm**, not 30. Change to **“Un’immagine reale della stessa altezza si ottiene con p=q=2f=20 cm. Con l’oggetto a30 cm, l’immagine è invece a15 cm e alta metà.”** The correct key A is valid.

## Precision improvements before delivery

- **Q18:** State explicitly that the initial space between plates is vacuum (or air approximated as vacuum) and edge effects are neglected. Relative permittivity2 is relative to vacuum; C_f=2C_i assumes ε_r,initial=1. Suggested opening: “Un condensatore piano, inizialmente con vuoto fra le armature, viene caricato…”. No key change under that assumption.
- **Q27:** Say **“pressione assoluta iniziale”**. The ideal gas law uses absolute pressure; 100 kPa gauge would not produce150 kPa gauge. This removes a common misconception with one word.
- **Q07:** Add **“acqua in quiete”** to make the hydrostatic premise explicit.
- **Q05, feedback C:** The choice50 J is the raw force value, omitting both projection and displacement. The current “Manca il fattore dello spostamento” alone would suggest50×4=200 J. Replace with “Hai riutilizzato il valore della forza come energia: servono sia cos60° sia lo spostamento di4m.”

## Verifier and grading caveats

`selected(n, letter, anchor)` ignores `letter`; many call-site letters disagree with the current shuffled key (e.g. Q02 passes A while the correct current option is C). The hardcoded key string plus anchor currently checks the correct option, so this is not a present key error, but the unused argument is misleading. Remove it or align and use explicit reviewed keys; do not simply start using the stale arguments.

Formula checks use hardcoded prompt constants, not extracted structured givens. Changing “12 N” to “15 N” in Q22 while leaving its key untouched would still pass. Keep their scope labeled arithmetic/schema checks; bind reviewed question bytes/digests or structured givens if claiming automatic semantic regression protection. Q03’s equality is a tautological numerical expression and does not independently test text meaning. None of these checks is scientific certification.

Completion answer arrays list only a few equivalent spellings. If the runtime uses exact string membership, mathematically valid entries such as `+40`, `4e1`, `40.00` or `0.200` would be marked wrong. Normalize a strictly parsed finite numeric input (comma/dot decimal, optional sign, optional exponent) with a tight stated tolerance, without accepting arbitrary expressions or embedded units; alternatively make the required spelling explicitly constrained. Validate blank separately from numeric zero.

Pedagogically the set has useful misconception-based distractors and explicit model constraints, but only31items and mostly short one/two-step tasks. Topic tags and correct-answer counts are not calibrated mastery or pass-probability measures. Preserve DRAFT and humanApproval=false after these corrections.
