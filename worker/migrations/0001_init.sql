-- One vault per sync code. The server only ever sees a hash of a key derived from the
-- code, and every record and photo arrives already encrypted on the device.
CREATE TABLE vaults (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  -- Bumped on every write, so devices can ask for "everything after N".
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE records (
  vault TEXT NOT NULL,
  key TEXT NOT NULL,
  version INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  data TEXT,
  PRIMARY KEY (vault, key)
);

CREATE INDEX records_by_seq ON records (vault, seq);
