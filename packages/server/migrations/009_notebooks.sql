-- v11 adds private notebook organization over canonical documents. Existing
-- envelopes migrate on read without rewriting historical receipts or imports.
ALTER TABLE ardesia_next.workspaces DROP CONSTRAINT workspaces_snapshot_check;
ALTER TABLE ardesia_next.workspaces ADD CONSTRAINT workspaces_snapshot_check
 CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' IN ('4','5','6','7','8','9','10','11'));
