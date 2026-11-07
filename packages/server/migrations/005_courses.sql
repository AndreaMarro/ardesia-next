-- Opening v4-v6 does not rewrite the original. The next accepted command writes v7.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check
 CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4', '5', '6', '7'));
