-- Expand accepted Core versions without rewriting any existing snapshot or receipt.
-- The runtime opens v4 through the explicit read-only migration; the next accepted
-- mutation commits v5. The previous application cannot open a workspace once it is v5.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check
  CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4', '5'));
