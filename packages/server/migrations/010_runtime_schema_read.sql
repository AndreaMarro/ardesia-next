-- Runtime can attest the operator-applied registry without changing it.
-- No schema, identity, credential or migration-write privilege is granted.
GRANT SELECT (version, digest) ON ardesia_next.schema_migrations TO ardesia_next_runtime;
