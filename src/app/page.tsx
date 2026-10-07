import Link from "next/link";
import { Bays } from "@/components/bays";
import { CompareFigure } from "@/components/compare-figure";
import { Endorsements } from "@/components/endorsements";
import { Hero } from "@/components/hero";
import { ProjectIndex } from "@/components/project-index";
import { ProjectEntry, ProvenanceLegend } from "@/components/project-entry";
import { Band, Section } from "@/components/section";
import { Skills } from "@/components/skills";
import { PersonSchema } from "@/components/structured-data";
import { bandOf, bandPlan, PROJECTS_PER_BAND } from "@/lib/bands";
import { buildMetadata } from "@/lib/metadata";
import { numberWord } from "@/lib/numbers";
import { projects } from "@/lib/projects";
import { contact, person } from "@/lib/site";
import { timeline } from "@/lib/timeline";

export const metadata = buildMetadata({ path: "/" });

export default function HomePage() {
  /* The cloud's side and shape for every band of the page: see lib/bands.ts,
     which is where they are changed. */
  const plan = bandPlan(projects.length);

  /* The projects in bands of two, one band for each side the work visits. */
  const work = plan.filter((band) => band.id === "work" || band.id.startsWith("work-"));
  const entries = work.map((_, band) =>
    projects.slice(band * PROJECTS_PER_BAND, (band + 1) * PROJECTS_PER_BAND),
  );
  const entry = (band: number, project: (typeof projects)[number], within: number) => (
    <ProjectEntry
      key={project.slug}
      project={project}
      index={band * PROJECTS_PER_BAND + within}
      strongest={band === 0 && within === 0}
    />
  );

  return (
    <>
      <PersonSchema />
      <Hero band={bandOf(plan, "hero")} />

      {/* The cloud changes sides, and shape, wherever the page changes its mind.

          The work used to be one band down one side, and the cloud was the
          brain, or a haze of it, from the first project to the last. It is bands
          of two projects now, the content alternating from one side of the
          screen to the other, and at every seam between two the cloud gathers
          itself up, crosses the strip with nothing written on it, and arrives
          as what the next band asked for. The rest of the page changes at the
          same kind of seam: the lanes run in pairs through the about band, the
          path and the tools, the references and the contact.

          Alternating guarantees a meeting. Two bands share the viewport for most
          of a scroll through the boundary between them, so where their sides
          differ one of them has its content where the cloud is, whichever side
          the cloud picks and whenever it crosses. What makes that safe is the
          seam, and what the engine does about it: the final pass cuts the cloud
          to each band's own column, split at the seam, so the part of the screen
          that is still the upper band is cut to its column and the part that is
          already the lower to its own. */}
      <Section
        {...bandOf(plan, "work")}
        eyebrow="Selected work"
        title="Index"
        intro={`${numberWord(projects.length, { capital: true })} projects, strongest evidence first. Ordered by how much of each result you can check for yourself, rather than by how large the number is. Every project states what it does not show.`}
      >
        <ProjectIndex />

        <div className="mt-16">
          <ProvenanceLegend />
        </div>

        {/* Two of the numbers below, drawn rather than listed.

            Both are already on this page as text in the entries underneath, and
            both are the kind of claim a list of statistics states and cannot
            show: that one figure is thirty one times another from the same
            model, and that a scan which found eleven and a half thousand
            violations in one surface found none at all in the one beside it.
            Nothing here is sourced from anywhere the entries are not. */}
        <div className="mt-16 grid gap-12 @4xl:grid-cols-2">
          <CompareFigure
            caption="Deribit, the same scan on two surfaces"
            axisLabel="Static arbitrage violations"
            rows={[
              {
                label: "Mark surface, which sets margin",
                value: 11593,
                display: "11,593",
                note: "235 of them at or above one full tick",
                tone: "flag",
              },
              {
                label: "The venue's own bid and ask",
                value: 0,
                display: "0",
                note: "88 snapshots, BTC and ETH chains",
                tone: "pass",
              },
            ]}
            reading="Marks are not tradeable prices, so this is a statement about the margin surface rather than about arbitrage available to anyone. The top of book is clean."
          />

          <CompareFigure
            caption="NY Fed ACM, re-estimated from the same data"
            axisLabel="Deviation from the published series"
            rows={[
              {
                label: "Fitted yield curve",
                value: 0.45,
                display: "0.45 bp",
                note: "the model reproduces the curve it is fitted to",
                tone: "pass",
              },
              {
                label: "Term premium drawn from it",
                value: 14,
                display: "14 bp",
                note: "31× the fitted error, same model and window",
                tone: "flag",
              },
            ]}
            reading="The quantity the model is fitted to comes back almost exactly. The quantity derived from it does not, and the gap is the finding rather than a bug in the reconstruction."
          />
        </div>

        <div className="mt-20 flex flex-col">
          {entries[0]!.map((project, within) => entry(0, project, within))}
        </div>
      </Section>

      {work.slice(1).map((band, index) => (
        <Band key={band.id} id={band.id} lane={band.lane} shape={band.shape}>
          <div className="flex flex-col">
            {entries[index + 1]!.map((project, within) => entry(index + 1, project, within))}
          </div>
        </Band>
      ))}

      <Section {...bandOf(plan, "about")} eyebrow="About" title="Why this way">
        <div className="longform">
          <p>
            I read {person.course} at {person.university}, and I have just come
            back from an exchange year at {person.exchange}, taught in French.
            Before that, Charterhouse, with A-levels in Mathematics, Economics
            and French.
          </p>
          <p>
            The projects on this page came out of a habit rather than a plan.
            Somebody publishes a number, I want to know how it was built, and the
            only way to find out is to build it again and see where the two
            answers part company. Most of the time they agree, and the exercise
            teaches me the method. Occasionally they do not, and that is the more
            interesting outcome: a mark surface that breaks static arbitrage
            eleven thousand times while the quotes beside it stay clean, a term
            premium that moves eighty-one basis points on the choice of start
            date, a backtest that turns from profit to loss once it is charged
            for its own trading.
          </p>
          <p>
            The habit has a cost worth naming. It makes me slow to accept a
            figure and slower to publish one, and there are results here that
            took longer to caveat than to compute. I would rather that than the
            alternative, which is a portfolio of numbers nobody can check.
          </p>
          <p>
            What I want next is to do this for a desk: equity research,
            quantitative methods, or the engineering underneath both.
          </p>
        </div>
      </Section>

      {/* The history itself is a page of its own, and this is the door to it.
          It keeps the id the scroll controller measures the timeline against,
          so the choreography still has a boundary here; what it does not keep is
          eight hundred words of dates in the middle of a page whose job is the
          work. */}
      <Section
        {...bandOf(plan, "path")}
        eyebrow="Path"
        title="Where I have studied and worked"
        intro="Four years of it, with what each place was actually for."
      >
        <div className="flex flex-col gap-10">
          <ol className="flex flex-col">
            {timeline.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className="scored-thin grid gap-2 py-5 first:border-t-0 first:pt-0 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"
              >
                <span className="tnum t-caption text-muted">
                  {entry.start} – {entry.end}
                </span>
                <div>
                  <span className="index-name block text-ink">{entry.title}</span>
                  <span className="t-label mt-1.5 block">{entry.org}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/path" className="pill pill-filled min-h-11">
              The whole path
            </Link>
            <Link href="/cv" className="pill pill-ghost min-h-11">
              One-page CV
            </Link>
          </div>
        </div>
      </Section>

      <Section {...bandOf(plan, "skills")} eyebrow="Tools" title="What I actually use">
        <Skills />
        <Bays />
      </Section>

      <Section
        {...bandOf(plan, "endorsements")}
        eyebrow="References"
        title="On record"
        intro="From people who have worked alongside me."
      >
        <Endorsements />
      </Section>

      <Section
        {...bandOf(plan, "contact")}
        eyebrow="Contact"
        title="Get in touch"
        intro="Happy to talk through any of the methods above, including the parts that did not work."
      >
        <div className="flex flex-wrap items-center gap-3">
          <a href={`mailto:${contact.email}`} className="pill pill-filled min-h-11">
            Email me
          </a>
          <a href={contact.linkedin} className="pill pill-ghost min-h-11">
            LinkedIn
          </a>
          <a href={contact.github} className="pill pill-ghost min-h-11">
            GitHub
          </a>
        </div>

        <dl className="scored mt-12 flex flex-wrap gap-x-16 gap-y-6 pt-6">
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">Email</dt>
            <dd>
              <a href={`mailto:${contact.email}`} className="link-arrow text-[0.9375rem]">
                {contact.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">LinkedIn</dt>
            <dd>
              <a href={contact.linkedin} className="link-arrow text-[0.9375rem]">
                /in/finnlakin
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">GitHub</dt>
            <dd>
              <a href={contact.github} className="link-arrow text-[0.9375rem]">
                FinnTech3
              </a>
            </dd>
          </div>
        </dl>
      </Section>
    </>
  );
}
