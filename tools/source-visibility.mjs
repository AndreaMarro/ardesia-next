const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const publicationFields = ['kind', 'owner', 'repository', 'visibility', 'scope', 'recordedAt'];

function utcTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 19) === value.slice(0, 19);
}

/** Source publication does not authorize a public application deployment or replace its protection gates. */
export function sourceVisibilityMatches(release) {
  if (!record(release) || !['private', 'public'].includes(release.visibility)) return false;
  if (!Object.hasOwn(release, 'sourcePublication')) return release.visibility === 'private';
  const publication = release.sourcePublication;
  return record(publication) && Object.keys(publication).length === publicationFields.length
    && publicationFields.every(field => Object.hasOwn(publication, field))
    && publication.kind === 'explicit-owner-instruction' && publication.owner === 'AndreaMarro'
    && publication.repository === 'AndreaMarro/ardesia-next' && publication.repository === release.repository
    && publication.visibility === 'public' && publication.scope === 'source-only'
    && utcTimestamp(publication.recordedAt) && typeof release.observedAt === 'string'
    && Number.isFinite(Date.parse(release.observedAt)) && Date.parse(publication.recordedAt) <= Date.parse(release.observedAt);
}
