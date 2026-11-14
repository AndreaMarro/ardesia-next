# Independent scientific-content review — 14 November 2026

**Result: one low-severity scope clarification found, corrected by the integration agent, and independently verified. No further concrete incorrect numerical result or answer key identified within the scope below.** This is an AI review, not human scientific approval or exhaustive certification.

## Exact review scope

- Read the complete prompts and solutions of all **79 original problems**, including all **10 multiple-choice questions and their 50 option feedbacks**. Independently recalculated the numerical/algebraic results of all 79; the recorded ID union exactly matches the original-problem bank.
- Read the prompts and answers of all **200 assessments**, screening scientific meaning, arithmetic, units and model assumptions. This does not claim independent checking of every assessment hint or feedback field.
- Deep-read **7 of 38 theory lessons**, one from each syllabus unit: `sf-2026-u1-04`, `u2-03`, `u3-05`, `u4-02`, `u5-05`, `u6-07`, `u7-06` (all with the same `sf-2026-` prefix). Fields read included explanation, reference feedback, prediction, activity and transfer. Seven selected theory examples were independently recalculated.
- Checked integrity across all **5 packs, 38 lessons and 279 reader questions**: source-to-pack and pack-to-reader prompts/solutions; all 10 choice keys and 50 choice feedbacks; no missing or duplicate question IDs. The choice prompt expansions append the five options intentionally.

The three numerical result files record **86 passing derivations: 79 originals plus 7 theory examples**. Small nonzero quantities use relative tolerances, including photon energies and entropy; they are not accepted merely because their absolute magnitude is tiny. Exact IDs and source hashes are in `sampling.json`.

## CQ-01: clarify dimensional scope of the dot product — corrected

The vector introduction in `courses.json`, unit `sf-2026-u1-04`, originally stated `A·B = AxBx + AyBy` without specifying a plane. The same lesson includes a three-dimensional problem with A=(2,−1,2), B=(−1,2,2). Applying the introductory formula alone gives −4; the correct three-dimensional dot product is 0. The original problem and solution already gave the correct result.

The integration agent corrected the introduction to specify the xy plane and explicitly add `AzBz` in three dimensions. Independent comparison against baseline commit `7c9c061f5650d054acc8f4f8f4a53da30812fdcc` found exactly three changed C1 pack paths: rendered explanation text, input explanation, and source revision. The other four packs remained byte-identical. The reader contains the corrected wording. Original-problem and assessment banks remained unchanged. See `finding-CQ-01.json`, `integrated-vector-scope.patch` and `vector-propagation.json`.

## Nonblocking media metadata difference

Five units (`u2-01`, `u3-02`, `u5-04`, `u6-04`, `u7-07`) retain conservative “playback not verified” language in course/reader metadata while generated packs incorporate registry evidence that browser title/publisher and playback start were observed on **7 November 2026**. The registry supports that historical statement; full audiovisual review remains NOT_RUN. This is a generation-consistency opportunity, not a scientific-answer defect and not evidence of fresh playback on 14 November.

## Limits and evidence

Exam A/B were excluded because they were reviewed separately. The other 31 complete theory lessons and all 290 legacy practice objects were not exhaustively reviewed. The 279-question integrity claim refers specifically to **79 originals + 200 assessments**, not every educational object in the packs. No claim of official syllabus certification, human approval, or freedom from all scientific defects follows from this sample.

Evidence: `sampling.json`, `integrity.json`, `numerical-checks.json`, `extra-numerical-checks.json`, `remaining-numerical-checks.json`, and their corresponding Python scripts. Repository sources were read-only for this reviewer; only the integration agent made the correction.
