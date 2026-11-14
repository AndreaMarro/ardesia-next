-- Media remain in the same PostgreSQL authority. Never alter applied migration 001.
CREATE TABLE ardesia_next.recordings (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'),
  workspace_id text NOT NULL REFERENCES ardesia_next.workspaces(id),
  owner_account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  document_id text NOT NULL,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object' AND state->>'format' = 'ardesia-recording-state-v1'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recordings_document ON ardesia_next.recordings(workspace_id,document_id);
CREATE TABLE ardesia_next.recording_parts (
  recording_id text NOT NULL REFERENCES ardesia_next.recordings(id),
  part_index integer NOT NULL CHECK (part_index BETWEEN 0 AND 1023),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 524288),
  PRIMARY KEY (recording_id,part_index)
);
REVOKE ALL ON ardesia_next.recordings, ardesia_next.recording_parts FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON ardesia_next.recordings TO ardesia_next_runtime;
GRANT SELECT,INSERT,DELETE ON ardesia_next.recording_parts TO ardesia_next_runtime;
