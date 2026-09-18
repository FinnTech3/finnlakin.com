import { Endorsements } from "@/components/endorsements";
import { Hero } from "@/components/hero";
import { ProjectCard, ProvenanceLegend } from "@/components/project-card";
import { Section } from "@/components/section";
import { Skills } from "@/components/skills";
import { PersonSchema } from "@/components/structured-data";
import { Timeline } from "@/components/timeline";
import { buildMetadata } from "@/lib/metadata";
import { projects } from "@/lib/projects";
import { contact, person } from "@/lib/site";

export const metadata = buildMetadata({ path: "/" });

export default function HomePage() {
  return (
    <>
      <PersonSchema />
      <Hero />

      <Section
        id="work"
        eyebrow="Selected work"
        title="Ten projects, strongest evidence first"
        intro="Ordered by how much of each result you can check for yourself, rather than by how large the number is. Every project states what it does not show."
      >
        <ProvenanceLegend />
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

      <Section id="about" eyebrow="About" title="Why this way" band>
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

      <Section id="timeline" eyebrow="Path" title="Where I have studied and worked">
        <Timeline />
      </Section>

      <Section id="skills" eyebrow="Tools" title="What I actually use" band>
        <Skills />
      </Section>

      <Section
        id="endorsements"
        eyebrow="References"
        title="From people who have worked alongside me"
      >
        <Endorsements />
      </Section>

      <Section
        id="contact"
        eyebrow="Contact"
        title="Open to Summer 2026 conversations"
        band
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
