import { getPool } from "./db";

/* The only migration mechanism there is. Every statement is idempotent, and
   new columns are appended as ALTER ... ADD COLUMN IF NOT EXISTS *after* the
   create rather than edited into it: a deployed database already has the
   table, so it skips a modified CREATE entirely and never sees the new
   column.

   The table is `site_analytics` rather than the obvious `analytics_events`
   because that obvious name was already taken. Another of Finn's sites keeps
   an `analytics_events` of its own, with a UUID id, `event_name` instead of
   `event`, `occurred_at` instead of `created_at`, and two NOT NULL foreign
   keys this schema knows nothing about. Point both sites at one database and
   whichever ran first owns the name: the second CREATE IF NOT EXISTS quietly
   does nothing, and every insert afterwards fails on columns that are not
   there.

   That failure is invisible from the outside. The write happens in after()
   and the collector answers 204 whatever occurs, by design, so the symptom is
   an empty dashboard and no error anywhere. A name nobody else would choose
   costs nothing and removes the whole class. Use a separate database anyway. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS site_analytics (
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
  `CREATE INDEX IF NOT EXISTS site_analytics_created_at_idx
     ON site_analytics (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS site_analytics_event_created_idx
     ON site_analytics (event, created_at DESC)`,
  // Append future ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements below.
];

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      /* Sent as one statement rather than a loop of awaits. They are
         independent and idempotent, so three sequential round trips bought
         nothing and every new serverless instance paid for them before its
         first insert. */
      await getPool().query(STATEMENTS.join(";\n"));
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
