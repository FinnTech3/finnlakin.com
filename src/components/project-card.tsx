import Link from "next/link";
import { IntervalBand } from "@/components/charts";
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
    <dl className="grid gap-x-10 gap-y-6 border-y border-rule py-7 sm:grid-cols-2 lg:grid-cols-4">
      {used.map((kind) => (
        <div key={kind} className="flex flex-col gap-2">
          <dt className="t-label text-ink">{provenanceShort[kind]}</dt>
          <dd className="max-w-[46ch] text-[14px] leading-relaxed font-extralight text-muted">
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
  return "text-ink";
}

/* No card. The border, the fill and the padding are gone, and what separates
   one project from the next is a hairline and a great deal of space, which is
   what the design reference means by letting things float on the void.

   The two column split is the reference's own rhythm: the name and the claim
   on the left, the evidence on the right. Nothing was dropped to get there. */
export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const ordinal = String(index + 1).padStart(2, "0");

  return (
    <article className="row-hover border-t border-rule py-14 first:border-t-0 first:pt-0">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-20">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="t-caption tnum uppercase tracking-[0.13em] text-spark">
              {ordinal}
            </span>
            <span className="t-caption uppercase tracking-[0.11em] text-muted">
              {project.stack}
            </span>
          </div>

          <h3 className="t-h mt-4 max-w-[16ch] text-ink text-balance">{project.name}</h3>

          <p className="mt-6 max-w-[34ch] text-pretty text-[clamp(1.125rem,2.2vw,1.5rem)] leading-[1.3] tracking-[-0.02em] text-ink">
            {project.headline}
          </p>

          <p className="t-caption mt-6 uppercase tracking-[0.11em] text-muted">
            {provenanceShort[project.provenance]}
          </p>
        </div>

        <div>
          <p className="measure text-[17px] leading-relaxed font-extralight text-ink-soft">
            {project.body}
          </p>

          {project.stats.length > 0 ? (
            <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {project.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1.5">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd
                    className={`tnum text-[1.6rem] leading-none tracking-[-0.03em] ${toneClass(stat.tone)}`}
                  >
                    {stat.value}
                  </dd>
                  <p aria-hidden="true" className="t-caption leading-snug text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </dl>
          ) : null}

          {project.band ? (
            <div className="mt-9">
              <IntervalBand {...project.band} />
            </div>
          ) : null}

          <p className="measure mt-9 border-l border-rule-strong pl-5 text-[14px] leading-relaxed font-extralight text-muted">
            <span className="text-ink">What this does not show. </span>
            {project.limits}
          </p>

          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
            {project.writing ? (
              <Link
                href={`/writing/${project.writing}`}
                className="t-label border-b border-accent pb-1 text-accent hover:border-b-2"
              >
                Read the write-up
              </Link>
            ) : null}
            {project.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="t-label border-b border-rule pb-1 text-accent hover:border-accent"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
