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

/* Four compositions, and a project takes the one its place in the list gives it.
   Ten entries in one template were ten times the same page, which is the thing
   that made the work feel like a single long block however many pictures were in
   it. Every one of the four carries everything an entry has to carry, so what
   changes from one to the next is what the eye lands on first:

     figure   the number that carries the project, as large as a number can be set
     clip     the picture, full width, before anything is said about it
     split    the argument on one side and the evidence on the other
     poster   the sentence the project is about, set as the page's biggest type

   They run in that order and come round again, so no two neighbours are alike and
   the ten are never more than three entries from a change. */
export type EntryKind = "figure" | "clip" | "split" | "poster";
const KINDS: readonly EntryKind[] = ["figure", "clip", "split", "poster"];

export function kindOf(index: number): EntryKind {
  return KINDS[index % KINDS.length]!;
}

/* The ordinal and what it is built with, and how far the evidence goes. */
function Meta({ project, ordinal }: { project: Project; ordinal: string }) {
  return (
    <p className="t-label flex flex-wrap items-baseline gap-x-4 gap-y-1">
      <span className="tnum text-tone">{ordinal}</span>
      <span>{project.stack}</span>
      <span className="text-ink">{provenanceShort[project.provenance]}</span>
    </p>
  );
}

/* One statistic. A figure that did not hold is a swatch, one that did is plain,
   and the label is the sentence that says which, because nothing here is carried
   by a colour alone. */
function Stat({ stat }: { stat: Project["stats"][number] }) {
  return (
    <div className="stat">
      <dt className="sr-only">{stat.label}</dt>
      <dd className="stat-value">
        {stat.tone === "flag" ? (
          <span className="flag">{stat.value}</span>
        ) : (
          <span className={stat.tone === "pass" ? "held" : "text-ink"}>{stat.value}</span>
        )}
      </dd>
      <p aria-hidden="true" className="stat-label">
        {stat.label}
      </p>
    </div>
  );
}

/* Two across, and four across only where the statistics have the whole width of
   the entry. The container query is the entry's, not the list's own, so a list
   that is only half of the entry's width cannot ask the question for itself: at
   a wide window it was told there was room for four and gave each of them a
   hundred pixels, which broke a figure across two lines and ran another out
   of its column. The caller says how wide the list is. */
function Stats({
  stats,
  className = "",
  wide = false,
}: {
  stats: Project["stats"];
  className?: string;
  wide?: boolean;
}) {
  if (stats.length === 0) return null;
  return (
    <dl className={`grid grid-cols-2 gap-x-8 gap-y-7 ${wide ? "@5xl:grid-cols-4" : ""} ${className}`}>
      {stats.map((stat) => (
        <Stat key={stat.label} stat={stat} />
      ))}
    </dl>
  );
}

/* The sentence this site exists to make room for. The strongest project's is a
   sheet of paper, which is the one place on the page that is lit like that, and
   it is not repeated down the list: a bright panel under every entry stops being
   an accent and becomes the background, and the caveat it carries stops being
   read. The other nine state the same thing in glass. */
function Limits({ project, paper = false, voice = false }: { project: Project; paper?: boolean; voice?: boolean }) {
  if (voice) {
    return (
      <blockquote className="m-0 border-l-2 border-tone pl-6">
        <p className="t-label text-ink">What this does not show</p>
        <p className="mt-3 max-w-[34em] font-serif text-[clamp(1.25rem,2vw,1.6rem)] leading-[1.4] text-ink-soft italic">
          {project.limits}
        </p>
      </blockquote>
    );
  }
  return (
    <div className={paper ? "chalk-block" : "glass p-5 @3xl:p-6"}>
      <p className="measure t-caption leading-relaxed text-muted">
        <span className="font-bold text-ink">What this does not show.{" "}</span>
        {project.limits}
      </p>
    </div>
  );
}

function Links({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-3">
      {project.writing ? (
        <Link href={`/writing/${project.writing}`} className="link-arrow text-[0.9375rem]">
          Read the write-up <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : null}
      {project.links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="link-arrow inline-flex items-center gap-2 text-[0.9375rem]"
        >
          {isRepo(link.href) ? <GitHubMark /> : null}
          {link.label} <span aria-hidden="true">&rarr;</span>
        </a>
      ))}
    </div>
  );
}

/* A clip, on every project, which is what Finn asked for.

   The case against is in ATTENTION.md rather than acted on quietly: readers are
   documented to skip imagery that reads as decorative, and about half of these
   are atmosphere rather than evidence. Each one is a placeholder for a screen
   recording of the thing actually running, which would beat all of them. */
function ClipFigure({ project, wide = false }: { project: Project; wide?: boolean }) {
  const clip = clipById.get(projectClips[project.slug] ?? "");
  if (!clip) return null;
  return (
    <figure className="m-0">
      <div
        className={`relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-glass-edge ${
          wide ? "aspect-[21/9]" : "aspect-[16/9]"
        }`}
      >
        <ClipPlayer clip={clip} />
      </div>
      <figcaption className="t-caption mt-3 leading-relaxed text-muted">{clip.caption}</figcaption>
      {/* The credit is its own block rather than a word at the end of the
          caption. A link inside a run of prose has to be distinguishable by
          something other than colour, and link-arrow underlines on hover and
          focus only; out of the sentence, the rule does not apply and the
          caption reads better for it. */}
      <p className="t-caption mt-2 text-muted">
        <a href={clip.href} className="link-arrow">
          {clip.credit}
        </a>
      </p>
    </figure>
  );
}

/* The paragraph the repository's own README gave. */
function Body({ project }: { project: Project }) {
  return <p className="measure text-[1.0625rem] leading-[1.7] text-ink-soft">{project.body}</p>;
}

/* One entry in the index, with everything the card used to carry and nothing
   taken out. See the four kinds above. */
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
  const [lead, ...rest] = project.stats;
  /* A figure entry is built around its first statistic. A project with none has
     nothing to set large, and an entry that asked for a figure and had none would
     lose its argument along with it, so it takes the picture first instead. */
  const kind = kindOf(index) === "figure" && !lead ? "clip" : kindOf(index);

  return (
    <article
      id={project.slug}
      data-kind={kind}
      className="@container scored pt-8 pb-24"
    >
      <div data-reveal="">
        <Meta project={project} ordinal={ordinal} />
        <h3 className="t-hsm mt-4 max-w-[9em] text-ink text-balance">{project.name}</h3>
      </div>

      {kind === "figure" && lead ? (
        <>
          <div data-reveal="" className="mt-8 grid items-end gap-x-12 gap-y-6 @4xl:grid-cols-[auto_minmax(0,1fr)]">
            <div>
              <p className="figure-xl">
                {lead.tone === "flag" ? <span className="flag">{lead.value}</span> : lead.value}
              </p>
              <p className="t-caption mt-3 max-w-[32ch] leading-snug text-muted">{lead.label}</p>
            </div>
            <p className="lede max-w-[26em]">{project.headline}</p>
          </div>
          <div data-reveal="" className="mt-10 grid gap-x-12 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Body project={project} />
            <ClipFigure project={project} />
          </div>
          <Stats stats={rest} wide className="mt-10" />
        </>
      ) : null}

      {kind === "clip" ? (
        <>
          <div data-reveal="" className="mt-8">
            <ClipFigure project={project} wide />
          </div>
          <div data-reveal="" className="mt-10 grid gap-x-12 gap-y-8 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col gap-6">
              <p className="lede max-w-[24em]">{project.headline}</p>
              <Body project={project} />
            </div>
            <Stats stats={project.stats} className="self-start" />
          </div>
        </>
      ) : null}

      {kind === "split" ? (
        <>
          <div data-reveal="" className="mt-8 grid items-start gap-x-12 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <p className="lede max-w-[24em]">{project.headline}</p>
              <Body project={project} />
            </div>
            <div className="glass flex flex-col gap-8 p-6 @3xl:p-8">
              <Stats stats={project.stats} />
              {project.band ? <IntervalBand {...project.band} /> : null}
            </div>
          </div>
          <div data-reveal="" className="mt-10">
            <ClipFigure project={project} />
          </div>
        </>
      ) : null}

      {kind === "poster" ? (
        <>
          <p data-reveal="" className="poster-headline mt-8 max-w-[18em] text-pretty text-ink">
            {project.headline}
          </p>
          <div data-reveal="" className="mt-10 grid gap-x-12 gap-y-10 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Body project={project} />
            <Stats stats={project.stats} className="self-start" />
          </div>
          <div data-reveal="" className="mt-10">
            <ClipFigure project={project} wide />
          </div>
        </>
      ) : null}

      {/* A range, where the finding is a range, drawn under the argument it
          belongs to. In the split kind it is inside the evidence panel. */}
      {project.band && kind !== "split" ? (
        <div data-reveal="" className="mt-10">
          <IntervalBand {...project.band} />
        </div>
      ) : null}

      <div data-reveal="" className="mt-10">
        <Limits project={project} paper={strongest} voice={kind === "poster"} />
      </div>

      <div data-reveal="" className="mt-8">
        <Links project={project} />
      </div>
    </article>
  );
}
