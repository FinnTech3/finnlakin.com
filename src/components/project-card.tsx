import Link from "next/link";
import { provenanceLabel, provenanceOrder, provenanceShort } from "@/lib/claims";
import type { Project } from "@/lib/projects";
import { projects } from "@/lib/projects";

/* The four kinds of evidence are defined once, here, rather than restated on
   every card. Cards then carry only the short label. */
export function ProvenanceLegend() {
  const used = provenanceOrder.filter((kind) =>
    projects.some((project) => project.provenance === kind),
  );

  return (
    <dl className="grid gap-x-8 gap-y-4 border-y border-rule py-5 sm:grid-cols-2">
      {used.map((kind) => (
        <div key={kind} className="flex flex-col gap-1">
          <dt className="font-mono text-[11px] uppercase tracking-[0.11em] text-ink">
            {provenanceShort[kind]}
          </dt>
          <dd className="max-w-[52ch] text-xs leading-relaxed text-muted">
            {provenanceLabel[kind]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function toneClass(tone: "pass" | "flag" | undefined): string {
  if (tone === "pass") return "text-pass";
  if (tone === "flag") return "text-flag";
  return "";
}

export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const ordinal = String(index + 1).padStart(2, "0");

  return (
    <article className="border border-rule bg-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
          {ordinal} · {project.stack}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.09em] text-muted">
          {provenanceShort[project.provenance]}
        </span>
      </div>

      <h3 className="mt-3 font-serif text-[clamp(1.6rem,4vw,2.1rem)] leading-[1.08] tracking-[-0.015em]">
        {project.name}
      </h3>

      <p className="mt-4 max-w-[38ch] text-pretty text-[clamp(1.05rem,2.4vw,1.3rem)] font-medium leading-[1.35] tracking-[-0.012em]">
        {project.headline}
      </p>

      <p className="mt-4 max-w-[64ch] text-[15px] leading-relaxed text-ink-soft">
        {project.body}
      </p>

      {project.stats.length > 0 ? (
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-rule pt-5 sm:grid-cols-4">
          {project.stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <dt className="sr-only">{stat.label}</dt>
              <dd
                className={`font-mono text-[1.35rem] leading-none font-medium tabular-nums tracking-[-0.02em] ${toneClass(stat.tone)}`}
              >
                {stat.value}
              </dd>
              <p aria-hidden="true" className="text-xs leading-snug text-muted">
                {stat.label}
              </p>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-6 max-w-[64ch] border-l-2 border-rule-strong pl-4 text-[13px] leading-relaxed text-muted">
        <span className="font-medium text-ink">What this does not show. </span>
        {project.limits}
      </p>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {project.writing ? (
          <Link
            href={`/writing/${project.writing}`}
            className="border-b border-accent pb-0.5 font-mono text-[12px] text-accent hover:border-b-2"
          >
            Read the write-up
          </Link>
        ) : null}
        {project.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="border-b border-rule-strong pb-0.5 font-mono text-[12px] text-accent hover:border-accent"
          >
            {link.label}
          </a>
        ))}
      </div>
    </article>
  );
}
