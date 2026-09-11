import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import {
  TEST_ADMIN_PASSWORD,
  TEST_ANALYTICS_SALT,
  TEST_DATABASE_URL,
  degradedURL,
} from "../playwright.config";
import { identify, sanitiseMeta } from "../src/lib/analytics";
import { issueToken, verifyToken } from "../src/lib/admin-auth";
import { parseDays } from "../src/lib/analytics-queries";

const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });

let closed = false;
test.afterAll(async () => {
  /* afterAll runs once per project, and the pool is module scope. */
  if (closed) return;
  closed = true;
  await pool.end();
});

/* Rows left by another test change every count the next one measures, and
   truncating between tests races the insert in after(). Each test therefore
   writes to a path nothing else uses and asserts only on that path, so
   isolation does not depend on timing at all. */
const RUN = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const tag = (name: string) => `/t/${RUN}/${name}`;

async function rowsFor(path: string) {
  const result = await pool.query(
    "SELECT * FROM analytics_events WHERE path = $1 ORDER BY id",
    [path],
  );
  return result.rows;
}

async function waitForRows(path: string, expected: number) {
  await expect.poll(async () => (await rowsFor(path)).length, { timeout: 10_000 }).toBe(expected);
}

/* Proving a row was NOT written cannot be done by polling for zero, which
   passes instantly while the write is still in flight. Send a sentinel after
   it and wait for that to land: the collector inserts in request order, so the
   sentinel arriving means the one before it has already resolved either way. */
async function quiesce(
  request: { post: (url: string, options: { data: unknown }) => Promise<unknown> },
  name: string,
) {
  const sentinel = tag(`${name}-sentinel`);
  await request.post("/api/analytics", {
    data: { event: "page_view", meta: { path: sentinel } },
  });
  await waitForRows(sentinel, 1);
}

test.describe("identity", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "pure functions");

  test("the visitor id cannot be recomputed across days", () => {
    process.env.ANALYTICS_SALT = TEST_ANALYTICS_SALT;

    const monday = identify("1.2.3.4", "UA", "en-GB", new Date("2026-03-02T10:00:00Z"));
    const laterMonday = identify("1.2.3.4", "UA", "en-GB", new Date("2026-03-02T23:59:00Z"));
    const tuesday = identify("1.2.3.4", "UA", "en-GB", new Date("2026-03-03T00:01:00Z"));

    expect(monday).not.toBeNull();
    expect(monday!.visitorId).toBe(laterMonday!.visitorId);
    expect(monday!.visitorId).not.toBe(tuesday!.visitorId);
    expect(monday!.ipHash).not.toBe(tuesday!.ipHash);

    /* The address itself must not survive into either value. */
    expect(monday!.visitorId).not.toContain("1.2.3.4");
    expect(monday!.ipHash).not.toContain("1.2.3.4");
  });

  test("no usable secret means no identity at all", () => {
    const saved = process.env.ANALYTICS_SALT;
    process.env.ANALYTICS_SALT = "too-short";
    expect(identify("1.2.3.4", "UA", "en-GB")).toBeNull();
    process.env.ANALYTICS_SALT = "";
    expect(identify("1.2.3.4", "UA", "en-GB")).toBeNull();
    process.env.ANALYTICS_SALT = saved;
  });
});

test.describe("metadata allow-list", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "pure functions");

  test("drops anything not explicitly allowed", () => {
    const clean = sanitiseMeta({
      path: "/writing",
      seconds: 12,
      email: "someone@example.com",
      password: "hunter2",
      token: "abc",
      note: "free text",
    });

    expect(clean).toEqual({ path: "/writing", seconds: 12 });
    expect(Object.keys(clean)).not.toContain("email");
    expect(Object.keys(clean)).not.toContain("password");
  });

  test("bounds the values it does accept", () => {
    expect(sanitiseMeta({ seconds: 10_000_000 })).toEqual({ seconds: 3600 });
    expect(sanitiseMeta({ seconds: -5 })).toEqual({ seconds: 0 });
    expect((sanitiseMeta({ path: "x".repeat(5000) }).path as string).length).toBe(256);
    expect(sanitiseMeta(null)).toEqual({});
    expect(sanitiseMeta(["path"])).toEqual({});
  });
});

test.describe("parseDays", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "pure functions");

  test("falls back when the parameter is absent or junk", () => {
    /* searchParams.get() returns null when absent and Number(null) is 0,
       which is finite, so a Number.isFinite guard alone never reaches its
       default branch. */
    expect(parseDays(undefined)).toBe(30);
    expect(parseDays("")).toBe(30);
    expect(parseDays("abc")).toBe(30);
    expect(parseDays("-1")).toBe(30);
    expect(parseDays("7")).toBe(7);
    expect(parseDays("100000")).toBe(90);
  });
});

test.describe("collector", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "server behaviour");

  test("accepts a known event and writes one row", async ({ request }) => {
    const path = tag("accepts");
    const response = await request.post("/api/analytics", {
      data: { event: "page_view", meta: { path, viewport: "1200x800" } },
    });
    expect(response.status()).toBe(204);
    await waitForRows(path, 1);

    const row = (await rowsFor(path))[0];
    expect(row.event).toBe("page_view");
    expect(row.meta).toEqual({ path, viewport: "1200x800" });
    expect(row.visitor_id).toBeTruthy();
    expect(row.ip_hash).toBeTruthy();
  });

  test("rejects an event name that is not on the list", async ({ request }) => {
    const path = tag("unknown-event");
    for (const event of ["pageview", "PAGE_VIEW", "custom", "", null, 42]) {
      const response = await request.post("/api/analytics", {
        data: { event, meta: { path } },
      });
      expect(response.status(), `${String(event)} should be rejected`).toBe(400);
    }
    await quiesce(request, "unknown-event");
    expect(await rowsFor(path)).toEqual([]);
  });

  test("never stores a field outside the allow-list", async ({ request }) => {
    const path = tag("allow-list");
    await request.post("/api/analytics", {
      data: {
        event: "page_view",
        meta: { path, email: "leak@example.com", password: "hunter2", token: "abc" },
      },
    });
    await waitForRows(path, 1);

    const rows = await rowsFor(path);
    expect(rows[0].meta).toEqual({ path });

    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("leak@example.com");
    expect(dump).not.toContain("hunter2");
  });

  test("heartbeat is a separate event and never inflates the view count", async ({ request }) => {
    const path = tag("heartbeat");
    await request.post("/api/analytics", {
      data: { event: "page_view", meta: { path } },
    });
    for (const seconds of [15, 30, 45, 60]) {
      await request.post("/api/analytics", {
        data: { event: "heartbeat", meta: { path, seconds } },
      });
    }
    await waitForRows(path, 5);

    /* Five events in, and exactly one of them is a view. Were dwell reported
       as another page_view, this single read would land as five visits. */
    const rows = await rowsFor(path);
    expect(rows.filter((row) => row.event === "page_view")).toHaveLength(1);
    expect(rows.filter((row) => row.event === "heartbeat")).toHaveLength(4);
  });

  test("records nothing when Do Not Track is set, and still answers 204", async ({ request }) => {
    const path = tag("dnt");
    const response = await request.post("/api/analytics", {
      headers: { dnt: "1" },
      data: { event: "page_view", meta: { path } },
    });
    expect(response.status()).toBe(204);

    await quiesce(request, "dnt");
    expect(await rowsFor(path)).toEqual([]);
  });

  test("honours Global Privacy Control the same way", async ({ request }) => {
    const path = tag("gpc");
    const response = await request.post("/api/analytics", {
      headers: { "sec-gpc": "1" },
      data: { event: "page_view", meta: { path } },
    });
    expect(response.status()).toBe(204);

    await quiesce(request, "gpc");
    expect(await rowsFor(path)).toEqual([]);
  });

  test("takes geography from platform headers only", async ({ request }) => {
    const path = tag("geo");
    await request.post("/api/analytics", {
      headers: {
        "x-vercel-ip-country": "GB",
        "x-vercel-ip-country-region": "OXF",
        "x-vercel-ip-city": "Oxford",
      },
      data: { event: "page_view", meta: { path } },
    });
    await waitForRows(path, 1);

    expect((await rowsFor(path))[0]).toMatchObject({
      country: "GB",
      region: "OXF",
      city: "Oxford",
    });
  });

  test("stores no raw IP address anywhere on the row", async ({ request }) => {
    const path = tag("ip");
    await request.post("/api/analytics", {
      headers: { "x-forwarded-for": "203.0.113.77" },
      data: { event: "page_view", meta: { path } },
    });
    await waitForRows(path, 1);

    const dump = JSON.stringify(await rowsFor(path));
    expect(dump).not.toContain("203.0.113.77");
  });
});

test.describe("degrades without configuration", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "server behaviour");

  test("collects nothing but still answers 204", async ({ request }) => {
    const response = await request.post(`${degradedURL}/api/analytics`, {
      data: { event: "page_view", meta: { path: "/" } },
    });
    expect(response.status()).toBe(204);
  });

  test("public pages still render", async ({ page }) => {
    await page.goto(`${degradedURL}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Finn Lakin");
  });

  test("the dashboard is a 404 when no admin password is configured", async ({ request }) => {
    const response = await request.get(`${degradedURL}/admin/analytics`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("admin auth", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "server behaviour");

  test("a signed expiry verifies, a tampered one does not", () => {
    process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
    process.env.ADMIN_SECRET = "test-admin-secret-0123456789";

    const token = issueToken();
    expect(token).not.toBeNull();
    expect(verifyToken(token!)).toBe(true);

    const [, expiry, signature] = token!.split(".");
    expect(verifyToken(`v1.${Number(expiry) + 60_000}.${signature}`)).toBe(false);
    expect(verifyToken(`v1.${expiry}.${"0".repeat(signature.length)}`)).toBe(false);
    expect(verifyToken(`v1..${signature}`)).toBe(false);
    expect(verifyToken("nonsense")).toBe(false);
    expect(verifyToken(undefined)).toBe(false);

    /* The signing key is derived from the password, so changing it revokes
       every live session without a table to revoke from. */
    process.env.ADMIN_PASSWORD = "a-different-password";
    expect(verifyToken(token!)).toBe(false);
    process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD;
  });

  test("an expired token is refused", () => {
    expect(verifyToken(`v1.${Date.now() - 1000}.abc`)).toBe(false);
  });

  test("the dashboard 404s rather than 401s when signed out", async ({ request }) => {
    const response = await request.get("/admin/analytics", { maxRedirects: 0 });
    expect(response.status()).toBe(404);
  });

  test("a wrong password 404s rather than 401s", async ({ request }) => {
    const response = await request.post("/api/admin/session", {
      form: { password: "not-the-password" },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(404);
  });

  test("the right password opens the dashboard, and signing out closes it", async ({ page }) => {
    await page.goto("/admin/analytics?sign-in=1");
    await page.getByLabel("Password").fill(TEST_ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    await expect(page.getByText("Views", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    const response = await page.goto("/admin/analytics");
    expect(response?.status()).toBe(404);
  });
});

test.describe("the browser beacon", () => {
  test.skip(({ isMobile }) => Boolean(isMobile), "one viewport is enough");

  test("sends a page_view carrying only allowed fields", async ({ page }) => {
    /* Playwright cannot read a sendBeacon body: request.postData() and
       postDataBuffer() are both null for a Blob beacon. Wrap sendBeacon in
       the page and collect the payloads there instead. */
    await page.addInitScript(() => {
      const captured: unknown[] = [];
      (window as unknown as { __beacons: unknown[] }).__beacons = captured;
      const original = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
        if (data instanceof Blob) {
          data.text().then((text) => {
            try {
              captured.push(JSON.parse(text));
            } catch {
              captured.push(text);
            }
          });
        }
        return original(url, data);
      };
    });

    await page.goto("/writing/marked-to-model");
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as { __beacons: unknown[] }).__beacons.length), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);

    const beacons = await page.evaluate(
      () => (window as unknown as { __beacons: { event: string; meta: Record<string, unknown> }[] }).__beacons,
    );

    const first = beacons[0];
    expect(first.event).toBe("page_view");
    expect(first.meta.path).toBe("/writing/marked-to-model");

    const allowed = new Set(["path", "slug", "referrer_host", "target", "seconds", "viewport"]);
    for (const beacon of beacons) {
      for (const key of Object.keys(beacon.meta)) {
        expect(allowed.has(key), `beacon sent an unexpected field: ${key}`).toBe(true);
      }
    }
  });
});
