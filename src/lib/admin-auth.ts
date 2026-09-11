import { createHmac } from "node:crypto";
import { constantTimeEqual } from "./analytics";

/* Deliberately free of next/headers so the token logic can be exercised
   directly in tests rather than only through a running server. */

export const ADMIN_COOKIE = "fl_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

function credentials(): { password: string; secret: string } | null {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SECRET;
  if (!password || !secret || password.length < 8 || secret.length < 16) return null;
  return { password, secret };
}

/* Derived from the password as well as the secret, so changing the password
   changes the key and every cookie signed under the old one stops verifying.
   A session id in a table would need explicit revocation; this revokes by
   construction. */
function signingKey(): Buffer | null {
  const creds = credentials();
  if (!creds) return null;
  return createHmac("sha256", creds.secret).update(creds.password).digest();
}

function sign(expiresAt: number, key: Buffer): string {
  return createHmac("sha256", key).update(String(expiresAt)).digest("hex");
}

/* The cookie carries its own expiry and a signature over it, not a session id.
   There is no session table to look up and nothing to clean up. */
export function issueToken(): string | null {
  const key = signingKey();
  if (!key) return null;
  const expiresAt = Date.now() + SESSION_MS;
  return `v1.${expiresAt}.${sign(expiresAt, key)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token) return false;
  const key = signingKey();
  if (!key) return false;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;

  /* Test the raw string before coercing: Number("") is 0, and 0 is finite,
     so a Number.isFinite guard on its own would accept an empty expiry and
     then treat it as an epoch timestamp in the distant past. */
  const raw = parts[1];
  if (!/^\d+$/.test(raw)) return false;

  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  return constantTimeEqual(parts[2], sign(expiresAt, key));
}

export function checkPassword(candidate: unknown): boolean {
  const creds = credentials();
  if (!creds || typeof candidate !== "string") return false;
  return constantTimeEqual(candidate, creds.password);
}

export function adminConfigured(): boolean {
  return credentials() !== null;
}

export const SESSION_MAX_AGE_SECONDS = SESSION_MS / 1000;
