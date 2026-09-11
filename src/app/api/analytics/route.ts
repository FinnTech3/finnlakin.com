import { after } from "next/server";
import {
  analyticsConfigured,
  identify,
  isEventName,
  sanitiseMeta,
} from "@/lib/analytics";
import { databaseUrl, getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* A visitor must never see an analytics error, so every non-malformed request
   gets 204 including when the database is unreachable. */
const NO_CONTENT = new Response(null, { status: 204 });

/* In-process, and therefore nearly useless on serverless: each warm instance
   keeps its own Map, so the real ceiling is this number times however many
   instances are warm. It is here to stop one client hammering one instance,
   not as a security control. The cap sits far above what the collector itself
   produces (one page_view plus a heartbeat every fifteen seconds, so roughly
   twenty events a minute for an active reader) so that a reader never loses
   their own events to it. */
const LIMIT_PER_MINUTE = 300;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, now: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > LIMIT_PER_MINUTE;
}

function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "0.0.0.0";
}

export async function POST(request: Request) {
  const headers = request.headers;

  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") return NO_CONTENT;
  if (!analyticsConfigured() || !databaseUrl()) return NO_CONTENT;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!body || typeof body !== "object") return new Response(null, { status: 400 });
  const { event, meta } = body as { event?: unknown; meta?: unknown };
  if (!isEventName(event)) return new Response(null, { status: 400 });

  const identity = identify(
    clientIp(headers),
    headers.get("user-agent") ?? "",
    headers.get("accept-language") ?? "",
  );
  if (!identity) return NO_CONTENT;

  if (rateLimited(identity.ipHash, Date.now())) return NO_CONTENT;

  const clean = sanitiseMeta(meta);
  const path = typeof clean.path === "string" ? clean.path : null;

  /* The response does not wait on the database. A slow write must not become
     a slow page. */
  after(async () => {
    try {
      await ensureSchema();
      await getPool().query(
        `INSERT INTO analytics_events
           (event, visitor_id, ip_hash, path, country, region, city, meta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          event,
          identity.visitorId,
          identity.ipHash,
          path,
          headers.get("x-vercel-ip-country"),
          headers.get("x-vercel-ip-country-region"),
          headers.get("x-vercel-ip-city"),
          JSON.stringify(clean),
        ],
      );
    } catch {
      /* Swallowed deliberately. There is nowhere useful to report this to and
         the visitor has already had their 204. */
    }
  });

  return NO_CONTENT;
}
