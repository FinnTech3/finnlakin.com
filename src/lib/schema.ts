import { getPool } from "./db";

/* The only migration mechanism there is. Every statement is idempotent, and
   new columns are appended as ALTER ... ADD COLUMN IF NOT EXISTS *after* the
   create rather than edited into it: a deployed database already has the
   table, so it skips a modified CREATE entirely and never sees the new
   column. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS analytics_events (
     id          BIGSERIAL PRIMARY KEY,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     event       TEXT NOT NULL,
     visitor_id  TEXT,
     ip_hash     TEXT,
     path        TEXT,
     country     TEXT,
     region      TEXT,
     city        TEXT,
     meta        JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,
  `CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx
     ON analytics_events (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx
     ON analytics_events (event, created_at DESC)`,
  // Append future ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements below.
];

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const pool = getPool();
      for (const statement of STATEMENTS) {
        await pool.query(statement);
      }
    })().catch((error) => {
      /* Clear the cached promise so the next request retries. Without this a
         single failure, a cold database or a transient network blip, is
         cached as permanent for the life of the instance. */
      ready = null;
      throw error;
    });
  }

  return ready;
}

/* Exported for tests, which need to force a re-create against a fresh database
   inside one process. */
export function resetSchemaCache(): void {
  ready = null;
}
