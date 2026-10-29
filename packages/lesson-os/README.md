# LessonOS M0

Public API: `projectContinuity(events, documentId)` and
`studentProjection(document)`.

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
