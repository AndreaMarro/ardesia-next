# LessonOS M0

Public API: `projectContinuity(events, documentId)` and
`studentProjection(document)`.

`projectLearningDiary(authorizedWork)` derives attempts, feedback, amendments and
corrections from authorized Core records, without assuming a complete teacher
event stream. Counts describe explicit evidence, not inferred competence. See
[ADR0013](../../docs/adr/0013-learner-feedback.md).

`projectHandout(authorizedDocument, exactHistoricalSources)` derives a static,
versioned reading/export projection, preserving provenance and explicitly listing
unavailable source revisions. It grants no historical access and accepts neither
learner overlays nor audio frames as saved documents. The web consumer prints PDF
and downloads escaped LaTeX/TikZ. See [ADR0014](../../docs/adr/0014-lesson-handout.md).

Continuity is reconstructed from the complete authorized Core event stream.
The function rejects gaps in document revisions and creates no persistent state.
It returns a sequence of committed changes and the last committed revision.

The student projection returns `null` for a draft document, hides draft objects,
removes connections to hidden objects, and hides objects whose citations cannot
resolve to an approved source at the exact revision present in the projection.
This conservative M0 projection may hide an object citing a historical source;
it never treats the current source's approval as approval of an older revision.

These functions do not grant access. The consumer must obtain an authorized
snapshot from the Core first. Authentication, publication, student assignments
and authoritative progress are not implemented by these projections.
