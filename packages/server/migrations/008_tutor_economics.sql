-- v10 adds optional appointment costs/preparation. Existing rows, events and
-- receipts are preserved; Core upgrades the envelope in memory on authorized read.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check
 CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4','5','6','7','8','9','10'));
