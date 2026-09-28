import Link from "next/link";
import { CompareFigure } from "@/components/compare-figure";
import { Endorsements } from "@/components/endorsements";
import { Hero } from "@/components/hero";
import { ProjectCard, ProvenanceLegend } from "@/components/project-card";
import { Section } from "@/components/section";
import { Skills } from "@/components/skills";
import { PersonSchema } from "@/components/structured-data";
import { buildMetadata } from "@/lib/metadata";
import { projects } from "@/lib/projects";
import { contact, person } from "@/lib/site";
import { timeline } from "@/lib/timeline";

export const metadata = buildMetadata({ path: "/" });

export default function HomePage() {
  return (
    <>
      <PersonSchema />
      <Hero />

      {/* The lanes run in pairs: right for the work and the about band, left for
          the path and the tools, right again for the references and the
          contact. Not alternating, which is what this was.

          Alternating guarantees a collision. Two sections share the viewport for
          most of a scroll through the boundary between them, so if their lanes
          differ one of them has its content where the cloud is, whichever side
          the cloud picks and whenever it crosses. In pairs, four of the five
          boundaries have both sections on the same side and the cloud simply
          stays put; the two crossings that are left happen once each and are
          dimmed and shrunk while they do. */}
      <Section
        id="work"
        lane="right"
        eyebrow="Selected work"
        title="Ten projects, strongest evidence first"
        intro="Ordered by how much of each result you can check for yourself, rather than by how large the number is. Every project states what it does not show."
      >
        <ProvenanceLegend />

        {/* Two of the numbers below, drawn rather than listed.

            Both are already on this page as text in the cards underneath, and
            both are the kind of claim a list of statistics states and cannot
            show: that one figure is thirty one times another from the same
            model, and that a scan which found eleven and a half thousand
            violations in one surface found none at all in the one beside it.
            Nothing here is sourced from anywhere the cards are not. */}
        <div className="mt-10 grid gap-6 @4xl:grid-cols-2">
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

        <div className="mt-10 flex flex-col gap-6">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.slug}
              project={project}
              index={index}
              accent={index === 0}
            />
          ))}
        </div>
      </Section>

      <Section id="about" eyebrow="About" title="Why this way" band lane="right">
        <div className="measure flex flex-col gap-6 text-[17px] leading-[1.6] text-ink">
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

      {/* The history itself is a page of its own now, and this is the door to
          it. It keeps the id the scroll controller measures the timeline
          against, so the choreography still has a boundary here; what it does
          not keep is eight hundred words of dates in the middle of a page whose
          job is the work. */}
      <Section
        id="path"
        eyebrow="Path"
        title="Where I have studied and worked"
        lane="left"
        intro="Four years of it, with what each place was actually for."
      >
        <div className="flex flex-col gap-8">
          <ol className="flex flex-col gap-0">
            {timeline.slice(0, 3).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-rule py-5 first:border-t-0 first:pt-0"
              >
                <span className="tnum w-32 shrink-0 text-[15px] text-muted">
                  {entry.start} – {entry.end}
                </span>
                <span className="text-[17px] text-ink">{entry.title}</span>
                <span className="text-[15px] text-muted">{entry.org}</span>
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

      <Section id="skills" eyebrow="Tools" title="What I actually use" band lane="left">
        <Skills />
      </Section>

      <Section
        id="endorsements"
        eyebrow="References"
        title="From people who have worked alongside me"
        lane="right"
      >
        <Endorsements />
      </Section>

      <Section
        id="contact"
        eyebrow="Contact"
        title="Open to Summer 2026 conversations"
        band
        lane="right"
        intro={`Available for ${person.seeking}. Happy to talk through any of the methods above, including the parts that did not work.`}
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

        <dl className="mt-10 flex flex-wrap gap-x-16 gap-y-6">
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">Email</dt>
            <dd>
              <a href={`mailto:${contact.email}`} className="link-arrow text-[17px]">
                {contact.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">LinkedIn</dt>
            <dd>
              <a href={contact.linkedin} className="link-arrow text-[17px]">
                /in/finnlakin
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="t-label">GitHub</dt>
            <dd>
              <a href={contact.github} className="link-arrow text-[17px]">
                FinnTech3
              </a>
            </dd>
          </div>
        </dl>
      </Section>
    </>
  );
}
