-- v9 adds immutable material pages and ink anchors; old rows are preserved on read.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4','5','6','7','8','9'));
CREATE TABLE ardesia_next.materials (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES ardesia_next.workspaces(id),
  owner_account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  document_id text NOT NULL,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX materials_document ON ardesia_next.materials(workspace_id,document_id);
CREATE TABLE ardesia_next.material_parts (
  asset_id text NOT NULL REFERENCES ardesia_next.materials(id),
  part_index integer NOT NULL CHECK (part_index BETWEEN 0 AND 63),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  bytes bytea NOT NULL CHECK (octet_length(bytes) BETWEEN 1 AND 524288),
  PRIMARY KEY (asset_id,part_index)
);
REVOKE ALL ON ardesia_next.materials, ardesia_next.material_parts FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON ardesia_next.materials TO ardesia_next_runtime;
GRANT SELECT,INSERT ON ardesia_next.material_parts TO ardesia_next_runtime;
