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
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
      {used.map((kind) => (
        <div
          key={kind}
          className="flex flex-col gap-2 rounded-[--radius-card-sm] bg-card px-5 py-4"
        >
          <dt className="text-[15px] font-medium text-ink">{provenanceShort[kind]}</dt>
          <dd className="text-[14px] leading-relaxed text-muted">{provenanceLabel[kind]}</dd>
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

/* A card, now, and the brief's default one: mist grey, 24px radius, no border
   and no shadow. The black site had no cards at all, because on a void a card
   is a box drawn around nothing; on paper a card is how a block of content
   stops being a column of text.

   The two column split inside it is kept: the name and the claim on the left,
   the evidence on the right. Nothing was dropped to get there. */
export function ProjectCard({
  project,
  index,
  /* Whether this card carries the page's one peach surface. */
  accent = false,
}: {
  project: Project;
  index: number;
  accent?: boolean;
}) {
  const ordinal = String(index + 1).padStart(2, "0");

  return (
    <article className="rounded-[--radius-card] bg-card px-6 py-9 sm:px-9 sm:py-11">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-16">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="t-caption tnum text-faint">{ordinal}</span>
            <span className="t-label">{project.stack}</span>
          </div>

          <h3 className="t-hsm mt-3 max-w-[18ch] text-ink text-balance">{project.name}</h3>

          <p className="t-body-lg mt-5 max-w-[34ch] text-pretty text-ink">
            {project.headline}
          </p>

          <p className="t-label mt-5">{provenanceShort[project.provenance]}</p>
        </div>

        <div>
          <p className="measure text-[16px] leading-[1.55] text-ink">{project.body}</p>

          {project.stats.length > 0 ? (
            <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {project.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1.5">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd
                    className={`tnum text-[1.5rem] leading-none tracking-[-0.02em] ${toneClass(stat.tone)}`}
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

          {/* The peach surface, spent on the sentence this site exists to make
              room for: what the result does not show.

              Once. The brief says at most one peach card per page and it is
              right for a reason that is easy to miss until you see ten of
              them: a warm panel repeated down a column stops being an accent
              and becomes the background, and the caveat it was carrying stops
              being read. So the strongest project gets it and the other nine
              state the same thing in a hairline rule, which is what the rest
              of the page uses for an aside. */}
          <p
            className={
              accent
                ? "measure mt-9 rounded-[--radius-card-sm] bg-accent-warm px-5 py-4 text-[14px] leading-relaxed text-accent-warm-ink"
                : "measure mt-9 border-l border-rule-strong pl-5 text-[14px] leading-relaxed text-muted"
            }
          >
            <span className={accent ? "font-medium" : "font-medium text-ink"}>
              What this does not show.{" "}
            </span>
            {project.limits}
          </p>

          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
            {project.writing ? (
              <Link href={`/writing/${project.writing}`} className="link-arrow text-[16px]">
                Read the write-up <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : null}
            {project.links.map((link) => (
              <a key={link.href} href={link.href} className="link-arrow text-[16px]">
                {link.label} <span aria-hidden="true">&rarr;</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
