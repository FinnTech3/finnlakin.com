import { createHmac, timingSafeEqual } from "node:crypto";

/* A closed list, checked on the server. Not a pattern: something like
   /^[a-z][a-z0-9_]*$/ happily accepts "email" and "password" from anyone who
   posts them, and this endpoint is open to the internet. */
export const EVENT_NAMES = [
  "page_view",
  "heartbeat",
  "palette_open",
  "cv_download",
  "outbound_click",
  "writing_progress",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const EVENT_SET: ReadonlySet<string> = new Set(EVENT_NAMES);

/* Likewise closed. Every field the collector will ever store is named here. */
export const META_KEYS = [
  "path",
  "slug",
  "referrer_host",
  "target",
  "seconds",
  "viewport",
  /* Reading depth on a long-form piece, as a percentage milestone. */
  "depth",
] as const;

const META_SET: ReadonlySet<string> = new Set(META_KEYS);

const MAX_META_STRING = 256;
/* An hour. A heartbeat claiming more is either broken or lying. */
const MAX_SECONDS = 3600;

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function sanitiseMeta(input: unknown): Record<string, string | number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!META_SET.has(key)) continue;

    if (typeof value === "string") {
      const trimmed = value.slice(0, MAX_META_STRING);
      if (trimmed) out[key] = trimmed;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      if (key === "seconds") {
        out[key] = Math.max(0, Math.min(Math.round(value), MAX_SECONDS));
      } else {
        out[key] = value;
      }
    }
  }

  return out;
}

function secret(): string | null {
  const value = process.env.ANALYTICS_SALT;
  /* No usable secret means record nothing. Hashing under a guessable key is
     worse than not counting: it looks like anonymisation and is not. */
  if (!value || value.length < 16) return null;
  return value;
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/* The key itself is derived from the date, so it changes at midnight UTC.
   Yesterday's identifiers cannot be recomputed from today's key, which makes
   cross-day matching impossible rather than merely forbidden. */
/* Memoised on the day and the secret together. The value changes once per UTC
   day, and recomputing it per request made a third of the crypto in the hot
   path work that produced the same bytes every time. Keying on the secret as
   well means a rotated secret is not served from a stale cache. */
let cachedKey: { day: string; secret: string; key: Buffer } | null = null;

function dailyKey(now?: Date): Buffer | null {
  const base = secret();
  if (!base) return null;

  const day = utcDay(now);
  if (cachedKey && cachedKey.day === day && cachedKey.secret === base) {
    return cachedKey.key;
  }

  const key = createHmac("sha256", base).update(day).digest();
  cachedKey = { day, secret: base, key };
  return key;
}

export type VisitorIdentity = {
  visitorId: string;
  ipHash: string;
};

export function identify(
  ip: string,
  userAgent: string,
  acceptLanguage: string,
  now?: Date,
): VisitorIdentity | null {
  const key = dailyKey(now);
  if (!key) return null;

  return {
    visitorId: createHmac("sha256", key)
      .update(`${ip}\n${userAgent}\n${acceptLanguage}`)
      .digest("hex")
      .slice(0, 32),
    /* A hash of the address, never the address. */
    ipHash: createHmac("sha256", key).update(ip).digest("hex").slice(0, 32),
  };
}

export function analyticsConfigured(): boolean {
  return secret() !== null;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    /* Still compare, so the failure path costs the same as a length match. */
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
