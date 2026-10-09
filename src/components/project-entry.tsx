import Link from "next/link";
import { IntervalBand } from "@/components/charts";
import { ClipPlayer } from "@/components/clip";
import { provenanceLabel, provenanceOrder, provenanceShort } from "@/lib/claims";
import { clipById, projectClips } from "@/lib/media";
import type { Project } from "@/lib/projects";
import { projects } from "@/lib/projects";

/* The four kinds of evidence are defined once, here, rather than restated on
   every entry. Entries then carry only the short label.

   Container queries, not viewport ones. The bands leave two fifths of the
   screen to the cloud, so a block that is three fifths of a 1440px window is
   about 790px wide while every sm: and lg: rule in it still thinks it has the
   whole screen: measured, a four column statistics grid gave each label about
   a hundred pixels and set "mean absolute error against the published
   headline" one word to a line. A component inside a lane has to lay itself
   out against the room it has rather than against the window. */
export function ProvenanceLegend() {
  const used = provenanceOrder.filter((kind) =>
    projects.some((project) => project.provenance === kind),
  );

  return (
    <dl className="grid gap-x-8 gap-y-6 @xl:grid-cols-2 @4xl:grid-cols-4">
      {used.map((kind) => (
        <div key={kind} className="scored flex flex-col gap-2 pt-3">
          <dt className="t-label text-ink">{provenanceShort[kind]}</dt>
          <dd className="t-caption leading-relaxed text-muted">{provenanceLabel[kind]}</dd>
        </div>
      ))}
    </dl>
  );
}

/* Drawn from the href rather than from a flag on the link, so a repository
   link cannot be added without its mark and a mark cannot end up beside
   something that is not a repository. */
function isRepo(href: string): boolean {
  try {
    return new URL(href).hostname.replace(/^www\./, "") === "github.com";
  } catch {
    return false;
  }
}

/* Inline rather than an icon dependency, and aria-hidden because the link's own
   text already says what it is: a screen reader announcing "GitHub Repository"
   is the label read twice. */
function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      fill="currentColor"
    >
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

/* One entry in the index, with everything the card used to carry and nothing
   taken out: the name and the claim on the left, the evidence on the right. It
   is a scored line and a column of type now, not a box, because on a wall a box
   is a thing that has to be drawn and a line is a thing that is cut.

   The page's one inverted block goes where the peach card used to: on the
   sentence this site exists to make room for, what the result does not show.
   Once, for the same reason as before. A dark panel repeated down a column
   stops being an accent and becomes the background, and the caveat it was
   carrying stops being read. So the strongest project gets it and the other
   nine state the same thing under a thin line. */
export function ProjectEntry({
  project,
  index,
  strongest = false,
}: {
  project: Project;
  index: number;
  strongest?: boolean;
}) {
  const ordinal = String(index + 1).padStart(2, "0");
  const clip = clipById.get(projectClips[project.slug] ?? "");

  return (
    <article id={project.slug} className="@container scored pt-6 pb-20">
      <div className="grid gap-x-14 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div>
          <p className="t-label flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="tnum text-ink">{ordinal}</span>
            <span>{project.stack}</span>
          </p>

          <h3 className="t-hsm mt-3 max-w-[6.6em] text-ink text-balance">{project.name}</h3>

          <p className="t-body-lg mt-5 max-w-[34ch] text-pretty text-ink">{project.headline}</p>

          <p className="t-label mt-5">{provenanceShort[project.provenance]}</p>
        </div>

        <div>
          <p className="measure text-[0.875rem] leading-[1.7] text-ink">{project.body}</p>

          {/* A clip, on every project, which is what Finn asked for.

              The case against is in ATTENTION.md rather than acted on quietly:
              readers are documented to skip imagery that reads as decorative,
              and about half of these are atmosphere rather than evidence. Each
              one is a placeholder for a screen recording of the thing actually
              running, which would beat all of them. */}
          {clip ? (
            <figure className="m-0 mt-8">
              <div className="relative aspect-[16/9] w-full overflow-hidden border-2 border-carbon">
                <ClipPlayer clip={clip} />
              </div>
              <figcaption className="t-caption mt-3 leading-relaxed text-muted">
                {clip.caption}
              </figcaption>
              {/* The credit is its own block rather than a word at the end of
                  the caption. A link inside a run of prose has to be
                  distinguishable by something other than colour, and link-arrow
                  underlines on hover and focus only; out of the sentence, the
                  rule does not apply and the caption reads better for it. */}
              <p className="t-caption mt-2 text-muted">
                <a href={clip.href} className="link-arrow">
                  {clip.credit}
                </a>
              </p>
            </figure>
          ) : null}

          {project.stats.length > 0 ? (
            <dl className="mt-9 grid grid-cols-2 gap-x-8 gap-y-6 @5xl:grid-cols-4">
              {project.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-1.5">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-display text-[2.25rem] leading-none font-bold tracking-[-0.01em] uppercase">
                    {stat.tone === "flag" ? (
                      <span className="flag">{stat.value}</span>
                    ) : (
                      <span className={stat.tone === "pass" ? "held" : "text-ink"}>
                        {stat.value}
                      </span>
                    )}
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

          <div className={strongest ? "chalk-block mt-9" : "scored-thin mt-9 pt-4"}>
            <p className="measure t-caption leading-relaxed text-muted">
              <span className="font-bold text-ink">What this does not show.{" "}</span>
              {project.limits}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
            {project.writing ? (
              <Link href={`/writing/${project.writing}`} className="link-arrow text-[0.875rem]">
                Read the write-up <span aria-hidden="true">&rarr;</span>
              </Link>
            ) : null}
            {project.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="link-arrow inline-flex items-center gap-2 text-[0.875rem]"
              >
                {isRepo(link.href) ? <GitHubMark /> : null}
                {link.label} <span aria-hidden="true">&rarr;</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
