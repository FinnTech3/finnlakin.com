import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool?: Pool };

export function databaseUrl(): string | null {
  return process.env.POSTGRES_URL ?? null;
}

/* One pool per instance, cached on globalThis so a hot reload or a second
   import does not open a second one. max is deliberately small: serverless
   multiplies instances rather than connections, and a large per-instance pool
   exhausts the server's connection limit as soon as traffic spreads out. */
export function getPool(): Pool {
  if (!globalForPg.pool) {
    const url = databaseUrl();
    if (!url) throw new Error("POSTGRES_URL is not set");

    globalForPg.pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    });

    /* An idle client erroring out must not take the process with it. */
    globalForPg.pool.on("error", () => {});
  }

  return globalForPg.pool;
}
