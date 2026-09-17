import { Endorsements } from "@/components/endorsements";
import { Hero } from "@/components/hero";
import { ParticleBrain } from "@/components/particle-brain";
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
      <ParticleBrain />
      <Hero />

      <Section
        id="work"
        eyebrow="Selected work"
        title="Ten projects, strongest evidence first"
        intro="Ordered by how much of each result you can check for yourself, rather than by how large the number is. Every project states what it does not show."
      >
        <ProvenanceLegend />
        <div className="mt-8 flex flex-col gap-6">
          {projects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>
      </Section>

      <Section id="about" eyebrow="About" title="Why this way">
        <div className="measure flex flex-col gap-6 text-[18px] leading-[1.7] font-light text-ink-soft">
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

      <Section id="skills" eyebrow="Tools" title="What I actually use">
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
        intro={`Available for ${person.seeking}. Happy to talk through any of the methods above, including the parts that did not work.`}
      >
        <dl className="flex flex-wrap gap-x-16 gap-y-8">
          <div className="flex flex-col gap-2">
            <dt className="t-label text-spark">
              Email
            </dt>
            <dd>
              <a
                href={`mailto:${contact.email}`}
                className="border-b border-accent pb-1 text-[18px] text-accent hover:border-b-2"
              >
                {contact.email}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="t-label text-spark">
              LinkedIn
            </dt>
            <dd>
              <a
                href={contact.linkedin}
                className="border-b border-accent pb-1 text-[18px] text-accent hover:border-b-2"
              >
                /in/finnlakin
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-2">
            <dt className="t-label text-spark">
              GitHub
            </dt>
            <dd>
              <a
                href={contact.github}
                className="border-b border-accent pb-1 text-[18px] text-accent hover:border-b-2"
              >
                FinnTech3
              </a>
            </dd>
          </div>
        </dl>
      </Section>
    </>
  );
}
