import { getPool } from "./db";
import { ensureSchema } from "./schema";

export const RETENTION_DAYS = 90;

export type Totals = { views: number; visitors: number };
export type Row = { label: string; count: number };
export type Dwell = { label: string; seconds: number };

/* Vercel has no scheduler, so a retention promise kept by nothing is not a
   retention policy. This still runs off the dashboard request, the only
   request on this site guaranteed to happen on a human timescale, but it runs
   in after() rather than in front of the render: it feeds nothing the page
   displays, and an unbounded DELETE holding locks and generating WAL while
   somebody waits for a page is the wrong shape.

   Bounded per run for the same reason. The first run after a long gap would
   otherwise delete an arbitrary number of rows in one transaction; at this
   site's volume a 10,000 row ceiling clears a backlog over a few loads and
   keeps any single one small. */
const PRUNE_BATCH = 10_000;

export async function pruneOldRows(): Promise<number> {
  const result = await getPool().query(
    `DELETE FROM analytics_events
      WHERE id IN (
        SELECT id FROM analytics_events
         WHERE created_at < now() - ($1 || ' days')::interval
         LIMIT ${PRUNE_BATCH}
      )`,
    [String(RETENTION_DAYS)],
  );
  return result.rowCount ?? 0;
}

export type Dashboard = {
  totals: Totals;
  paths: Row[];
  countries: Row[];
  referrers: Row[];
  dwell: Dwell[];
  outbound: Row[];
  daily: Row[];
};

export async function loadDashboard(days: number): Promise<Dashboard> {
  await ensureSchema();
  const pool = getPool();
  const since = `${days} days`;

  const [totals, paths, countries, referrers, dwell, outbound, daily] = await Promise.all([
    pool.query<{ views: string; visitors: string }>(
      `SELECT
         count(*) FILTER (WHERE event = 'page_view')      AS views,
         count(DISTINCT visitor_id)                       AS visitors
       FROM analytics_events
       WHERE created_at > now() - $1::interval`,
      [since],
    ),
    pool.query<{ label: string; count: string }>(
      `SELECT coalesce(path, '(unknown)') AS label, count(*) AS count
       FROM analytics_events
       WHERE event = 'page_view' AND created_at > now() - $1::interval
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 20`,
      [since],
    ),
    pool.query<{ label: string; count: string }>(
      `SELECT coalesce(country, '(unknown)') AS label, count(DISTINCT visitor_id) AS count
       FROM analytics_events
       WHERE created_at > now() - $1::interval
       GROUP BY 1 ORDER BY count(DISTINCT visitor_id) DESC LIMIT 15`,
      [since],
    ),
    pool.query<{ label: string; count: string }>(
      `SELECT meta->>'referrer_host' AS label, count(*) AS count
       FROM analytics_events
       WHERE event = 'page_view'
         AND meta->>'referrer_host' IS NOT NULL
         AND created_at > now() - $1::interval
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 15`,
      [since],
    ),
    /* Each heartbeat carries cumulative seconds, so take the maximum per
       visitor and path and average those. Summing them would count a single
       ten minute read many times over. */
    pool.query<{ label: string; seconds: string }>(
      `SELECT label, round(avg(max_seconds)) AS seconds FROM (
         SELECT coalesce(path, '(unknown)') AS label,
                visitor_id,
                max((meta->>'seconds')::numeric) AS max_seconds
         FROM analytics_events
         WHERE event = 'heartbeat'
           AND meta ? 'seconds'
           AND created_at > now() - $1::interval
         GROUP BY 1, 2
       ) per_visitor
       GROUP BY label ORDER BY avg(max_seconds) DESC LIMIT 15`,
      [since],
    ),
    pool.query<{ label: string; count: string }>(
      `SELECT coalesce(meta->>'target', '(unknown)') AS label, count(*) AS count
       FROM analytics_events
       WHERE event IN ('outbound_click', 'cv_download')
         AND created_at > now() - $1::interval
       GROUP BY 1 ORDER BY count(*) DESC LIMIT 15`,
      [since],
    ),
    pool.query<{ label: string; count: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS label,
              count(*) FILTER (WHERE event = 'page_view') AS count
       FROM analytics_events
       WHERE created_at > now() - $1::interval
       GROUP BY 1 ORDER BY 1`,
      [since],
    ),
  ]);

  const rows = (result: { rows: { label: string; count: string }[] }): Row[] =>
    result.rows.map((row) => ({ label: row.label, count: Number(row.count) }));

  return {
    totals: {
      views: Number(totals.rows[0]?.views ?? 0),
      visitors: Number(totals.rows[0]?.visitors ?? 0),
    },
    paths: rows(paths),
    countries: rows(countries),
    referrers: rows(referrers),
    dwell: dwell.rows.map((row) => ({ label: row.label, seconds: Number(row.seconds) })),
    outbound: rows(outbound),
    daily: rows(daily),
  };
}

/* searchParams.get() returns null when the parameter is absent, and
   Number(null) is 0, which is finite. A default branch guarded only by
   Number.isFinite would therefore never run. Test the raw string first. */
export function parseDays(raw: string | undefined, fallback = 30): number {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, RETENTION_DAYS);
}
