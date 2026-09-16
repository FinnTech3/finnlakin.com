import type { Metadata } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifyToken } from "@/lib/admin-auth";
import {
  RETENTION_DAYS,
  loadDashboard,
  parseDays,
  pruneOldRows,
  type Dashboard,
  type Row,
} from "@/lib/analytics-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin/analytics" },
  openGraph: undefined,
  twitter: undefined,
};

function BarList({ rows, unit }: { rows: Row[]; unit?: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Nothing recorded yet.</p>;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-sm">{row.label}</span>
            <span className="tnum shrink-0 text-[15px] text-muted">
              {row.count.toLocaleString("en-GB")}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
          <div className="h-1 bg-rule">
            <div
              className="h-1 bg-accent"
              style={{ width: `${Math.max((row.count / max) * 100, 1)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-6">
      <h2 className="t-label mb-5 text-spark">
        {title}
      </h2>
      {children}
    </section>
  );
}

function SignIn() {
  return (
    <div className="mx-auto w-full max-w-sm px-5 py-24">
      <form method="post" action="/api/admin/session" className="flex flex-col gap-4">
        <label htmlFor="password" className="t-label text-spark">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border border-rule bg-black px-4 py-3 text-[16px] font-extralight outline-none focus:border-action"
        />
        <button
          type="submit"
          className="t-label inline-flex min-h-11 items-center justify-center rounded-full bg-action px-6 text-action-ink hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

function Dashboard({ data, days }: { data: Dashboard; days: number }) {
  return (
    <div className="gutter w-full py-14">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-6">
        <h1 className="t-h text-ink">Analytics</h1>
        <nav className="t-label flex gap-4">
          {[7, 30, 90].map((option) => (
            <a
              key={option}
              href={`/admin/analytics?days=${option}`}
              className={option === days ? "text-accent underline" : "text-muted hover:text-accent"}
            >
              {option}d
            </a>
          ))}
        </nav>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="t-label text-spark">Views</dt>
          <dd className="tnum text-[2rem] tracking-[-0.03em]">
            {data.totals.views.toLocaleString("en-GB")}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-label text-spark">
            Visitors
          </dt>
          <dd className="tnum text-[2rem] tracking-[-0.03em]">
            {data.totals.visitors.toLocaleString("en-GB")}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-label text-spark">Window</dt>
          <dd className="tnum text-[2rem] tracking-[-0.03em]">{days}d</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-label text-spark">
            Retention
          </dt>
          <dd className="tnum text-[2rem] tracking-[-0.03em]">{RETENTION_DAYS}d</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted">
        Visitors are counted per UTC day and cannot be matched across days, so the
        figure above is the sum of daily uniques rather than distinct people.
        Rows older than {RETENTION_DAYS} days are deleted after this request,
        in batches, rather than while the page is being rendered.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Panel title="Pages">
          <BarList rows={data.paths} />
        </Panel>
        <Panel title="Average time on page">
          <BarList
            rows={data.dwell.map((row) => ({ label: row.label, count: row.seconds }))}
            unit="s"
          />
        </Panel>
        <Panel title="Countries">
          <BarList rows={data.countries} />
        </Panel>
        <Panel title="Referrers">
          <BarList rows={data.referrers} />
        </Panel>
        <Panel title="Outbound and downloads">
          <BarList rows={data.outbound} />
        </Panel>
        <Panel title="Views per day">
          <BarList rows={data.daily} />
        </Panel>
      </div>

      <form method="post" action="/api/admin/session" className="mt-8 flex items-baseline gap-4">
        <input type="hidden" name="action" value="sign-out" />
        <button type="submit" className="t-label text-accent underline">
          Sign out
        </button>
        <span className="t-label text-muted">
          Sessions expire on their own after twelve hours.
        </span>
      </form>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: PageProps<"/admin/analytics">) {
  const params = await searchParams;

  if (!adminConfigured()) notFound();

  const jar = await cookies();
  if (!verifyToken(jar.get(ADMIN_COOKIE)?.value)) {
    /* 404 rather than 401 for the bare path, so a scanner learns nothing.
       The sign-in form is behind a query flag: anyone who already knows the
       path can reach it, which is the point, and nobody who does not can
       discover the route exists by probing it. */
    if (params["sign-in"] === undefined) notFound();
    return <SignIn />;
  }

  const rawDays = params.days;
  const days = parseDays(typeof rawDays === "string" ? rawDays : undefined);

  /* There is deliberately no loading.tsx beside this file. One was added to
     paint a shell while the seven queries resolve, and it broke the property
     the whole route is built on: a loading boundary streams, so the 200 status
     line goes out before notFound() runs and an unauthenticated probe gets 200
     with a skeleton instead of a 404. Being indistinguishable from a route
     that does not exist is worth more here than a faster first paint for the
     one person who ever signs in.

     Retention runs after the response rather than in front of it. There is no
     scheduler on the host, so it has to hang off a request that reliably
     happens, and this is the one; it does not have to be a request anybody is
     waiting on. Failures here are swallowed deliberately: a full table is a
     better outcome than a dashboard that will not load. */
  after(async () => {
    try {
      await pruneOldRows();
    } catch {
      /* next load tries again */
    }
  });

  let data: Dashboard;
  try {
    data = await loadDashboard(days);
  } catch {
    return (
      <div className="gutter w-full py-14">
        <h1 className="t-h text-ink">Analytics</h1>
        <p className="mt-4 max-w-[60ch] text-sm text-muted">
          The database is not reachable. Collection keeps returning 204 to
          visitors regardless, so nothing on the public site is affected.
        </p>
      </div>
    );
  }

  return <Dashboard data={data} days={days} />;
}
