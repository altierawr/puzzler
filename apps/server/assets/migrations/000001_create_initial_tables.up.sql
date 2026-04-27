CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE visibility as enum (
  'public',
  'unlisted',
  'private'
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now(),
  username citext UNIQUE NOT NULL,
  password_hash bytea NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tokens (
  hash bytea PRIMARY KEY,
  expiry timestamptz not null,
  scope text NOT NULL,
  family bytea NOT NULL,
  is_revoked boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY NOT NULL UNIQUE,
  name text NOT NULL,
  visibility visibility NOT NULL DEFAULT 'unlisted',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS puzzles (
  id text PRIMARY KEY NOT NULL UNIQUE,
  name text,
  fen text NOT NULL,
  moves text NOT NULL,
  visibility visibility NOT NULL DEFAULT 'unlisted',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collections_puzzles (
  collections_id text,
  puzzles_id text,
  PRIMARY KEY (collections_id, puzzles_id),
  CONSTRAINT fk_collection FOREIGN KEY(collections_id) REFERENCES collections(id),
  CONSTRAINT fk_puzzle FOREIGN KEY(puzzles_id) REFERENCES puzzles(id)
);
