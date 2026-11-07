-- Preserve original v4-v7 rows; the next accepted command writes v8.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check
 CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4', '5', '6', '7', '8'));
