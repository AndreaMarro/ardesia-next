-- Run only against a dedicated Ardesia Next database, as its migration owner.
-- No objects are created in public; no legacy schema or Auth tables are changed.
CREATE SCHEMA IF NOT EXISTS ardesia_next;
REVOKE ALL ON SCHEMA ardesia_next FROM PUBLIC;

CREATE TABLE ardesia_next.accounts (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$'),
  username text UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  password_hash text NOT NULL,
  disabled_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ardesia_next.sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_account ON ardesia_next.sessions(account_id);
CREATE INDEX sessions_expiry ON ardesia_next.sessions(expires_at);

CREATE TABLE ardesia_next.login_limits (
  bucket text PRIMARY KEY CHECK (length(bucket) <= 100),
  started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL CHECK (attempts > 0)
);

CREATE TABLE ardesia_next.workspaces (
  id text PRIMARY KEY,
  owner_account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object' AND snapshot->>'schemaVersion' = '4'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workspaces_owner ON ardesia_next.workspaces(owner_account_id);
CREATE INDEX workspaces_assignments ON ardesia_next.workspaces USING gin ((snapshot->'assignments'));

-- Only an operator-bound owner alias is persisted. Browser input never selects it.
CREATE TABLE ardesia_next.owner_bindings (
  workspace_id text PRIMARY KEY REFERENCES ardesia_next.workspaces(id),
  account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  actor_id text NOT NULL CHECK (actor_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$')
);

CREATE TABLE ardesia_next.import_archives (
  workspace_id text PRIMARY KEY REFERENCES ardesia_next.workspaces(id),
  account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  digest text NOT NULL CHECK (digest ~ '^[0-9a-f]{64}$'),
  semantic_digest text NOT NULL CHECK (semantic_digest ~ '^[0-9a-f]{64}$'),
  original_text text NOT NULL,
  source_version integer NOT NULL CHECK (source_version BETWEEN 1 AND 3),
  source_workspace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, digest),
  UNIQUE (account_id, semantic_digest)
);

CREATE TABLE ardesia_next.creation_receipts (
  account_id text NOT NULL REFERENCES ardesia_next.accounts(id),
  command_id text NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  workspace_id text NOT NULL REFERENCES ardesia_next.workspaces(id),
  PRIMARY KEY (account_id, command_id)
);

REVOKE ALL ON ALL TABLES IN SCHEMA ardesia_next FROM PUBLIC;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ardesia_next_runtime') THEN
    CREATE ROLE ardesia_next_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA ardesia_next TO ardesia_next_runtime;
GRANT SELECT ON ardesia_next.accounts TO ardesia_next_runtime;
-- PostgreSQL row locks require UPDATE on at least one column. Runtime may only
-- update login telemetry; identity, role, credential and disabled status remain operator-only.
GRANT UPDATE(last_login_at) ON ardesia_next.accounts TO ardesia_next_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ardesia_next.sessions, ardesia_next.login_limits TO ardesia_next_runtime;
GRANT SELECT, INSERT, UPDATE ON ardesia_next.workspaces TO ardesia_next_runtime;
GRANT SELECT, INSERT ON ardesia_next.owner_bindings, ardesia_next.import_archives, ardesia_next.creation_receipts TO ardesia_next_runtime;
-- Attach a separate credentialed LOGIN role to ardesia_next_runtime during provisioning.
-- The runtime has no DDL, account provisioning, role change or backup-restore authority.
