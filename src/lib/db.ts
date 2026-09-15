import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool };

export function databaseUrl(): string | null {
  return process.env.POSTGRES_URL ?? null;
}

/* One pool per instance, cached on globalThis so a hot reload or a second
   import does not open a second one. max stays small: serverless multiplies
   instances rather than connections, and a large per-instance pool exhausts
   the server's connection limit as soon as traffic spreads out.

   It is 8 rather than 3 because the dashboard fans seven queries out at once
   and a ceiling of three turned that Promise.all into three sequential waves.
   Connections are opened on demand, so the collector, which issues one query
   per request, still settles at one or two: the wider ceiling costs nothing
   until the one authenticated dashboard request actually needs it. */
export function getPool(): Pool {
  if (!globalForPg.pool) {
    const url = databaseUrl();
    if (!url) throw new Error("POSTGRES_URL is not set");

    globalForPg.pool = new Pool({
      connectionString: url,
      max: 8,
      /* Must outlast the beacon's heartbeat. public/analytics.js sends one
         event every 15s, so a 10s idle timeout meant a single reader on a
         single page paid a fresh TCP connect and TLS handshake for every
         heartbeat, forever: the pool closed the connection five seconds
         before the next one arrived and never got to reuse anything. */
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    });

    /* An idle client erroring out must not take the process with it. */
    globalForPg.pool.on("error", () => {});
  }

  return globalForPg.pool;
}
