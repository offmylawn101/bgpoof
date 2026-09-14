-- Only an aggregate count and its start date are stored, never image/user data.
CREATE TABLE IF NOT EXISTS processing_stats (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  images_processed INTEGER NOT NULL DEFAULT 0 CHECK (images_processed >= 0),
  since TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO processing_stats (id) VALUES (1);
