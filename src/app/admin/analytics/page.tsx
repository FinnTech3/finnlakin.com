import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifyToken } from "@/lib/admin-auth";
import {
  RETENTION_DAYS,
  loadDashboard,
  parseDays,
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
            <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
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
    <section className="border border-rule bg-panel p-5">
      <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
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
        <label htmlFor="password" className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border border-rule bg-panel px-3 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="border border-accent px-3 py-2.5 font-mono text-xs text-accent hover:bg-accent-soft"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

function Dashboard({ data, days }: { data: Dashboard; days: number }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-rule pb-6">
        <h1 className="font-serif text-3xl tracking-[-0.02em]">Analytics</h1>
        <nav className="flex gap-3 font-mono text-xs">
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
          <dt className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">Views</dt>
          <dd className="font-mono text-3xl tabular-nums">
            {data.totals.views.toLocaleString("en-GB")}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
            Visitors
          </dt>
          <dd className="font-mono text-3xl tabular-nums">
            {data.totals.visitors.toLocaleString("en-GB")}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">Window</dt>
          <dd className="font-mono text-3xl tabular-nums">{days}d</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">Pruned</dt>
          <dd className="font-mono text-3xl tabular-nums">{data.pruned}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted">
        Visitors are counted per UTC day and cannot be matched across days, so the
        figure above is the sum of daily uniques rather than distinct people.
        Rows older than {RETENTION_DAYS} days are deleted on this request.
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
        <button type="submit" className="font-mono text-xs text-accent underline">
          Sign out
        </button>
        <span className="font-mono text-xs text-muted">
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

  let data: Dashboard;
  try {
    data = await loadDashboard(days);
  } catch {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8">
        <h1 className="font-serif text-3xl tracking-[-0.02em]">Analytics</h1>
        <p className="mt-4 max-w-[60ch] text-sm text-muted">
          The database is not reachable. Collection keeps returning 204 to
          visitors regardless, so nothing on the public site is affected.
        </p>
      </div>
    );
  }

  return <Dashboard data={data} days={days} />;
}
