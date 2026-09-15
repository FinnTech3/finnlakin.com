import { buildMetadata } from "@/lib/metadata";
import { contact, person } from "@/lib/site";
import { languages, skillGroups } from "@/lib/skills";
import { timeline } from "@/lib/timeline";

export const metadata = buildMetadata({
  path: "/cv",
  title: "CV",
  description: `Curriculum vitae for ${person.name}: ${person.course} at ${person.university}, with an exchange year at ${person.exchange}.`,
});

const education = timeline.filter((entry) => entry.kind === "education");
const work = timeline.filter((entry) => entry.kind === "work");

function Entries({ entries }: { entries: typeof timeline }) {
  return (
    <ol className="flex flex-col gap-6">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="text-[15px] font-medium">{entry.title}</h3>
            <span className="font-mono text-xs tabular-nums text-muted">
              {entry.start} – {entry.end}
            </span>
          </div>
          <p className="text-sm text-muted">
            {entry.org} · {entry.location}
          </p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
            {entry.points.map((point) => (
              <li key={point} className="max-w-[70ch] text-sm leading-relaxed text-ink-soft">
                {point}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule pt-5">
      <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.13em] text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CvPage() {
  return (
    <div className="cv-print mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-3 pb-8">
        <h1 className="font-serif text-[clamp(2rem,6vw,2.8rem)] leading-[1.05] tracking-[-0.025em]">
          {person.name}
        </h1>
        <p className="text-[15px] text-muted">
          {person.course} · {person.university} · Class of {person.graduation}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <a href={`mailto:${contact.email}`} className="font-mono text-xs text-accent">
            {contact.email}
          </a>
          <a href={contact.linkedin} className="font-mono text-xs text-accent">
            linkedin.com/in/finnlakin
          </a>
          <a href={contact.github} className="font-mono text-xs text-accent">
            github.com/FinnTech3
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <a
            href="/finn-lakin-cv.pdf"
            data-analytics-event="cv_download"
            className="print-hidden border border-accent px-3 py-2 font-mono text-xs text-accent hover:bg-accent-soft"
          >
            Download PDF
          </a>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        <Block title="Profile">
          <p className="max-w-[70ch] text-sm leading-relaxed text-ink-soft">
            Final-year {person.course} student at {person.university}, on track for
            First-Class Honours, back from an exchange year at {person.exchange}{" "}
            taught in French. I rebuild published financial and economic series
            from primitives and report where the reconstruction disagrees, in
            Python, R, Rust and TypeScript. Seeking {person.seeking}.
          </p>
        </Block>

        <Block title="Experience">
          <Entries entries={work} />
        </Block>

        <Block title="Education">
          <Entries entries={education} />
        </Block>

        <Block title="Skills">
          <dl className="flex flex-col gap-3">
            {skillGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="min-w-28 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                  {group.label}
                </dt>
                <dd className="text-sm text-ink-soft">{group.items.join(" · ")}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="min-w-28 font-mono text-xs uppercase tracking-[0.1em] text-muted">
                Languages
              </dt>
              <dd className="text-sm text-ink-soft">
                {languages
                  .map((language) => `${language.name}, ${language.level.toLowerCase()}`)
                  .join(" · ")}
              </dd>
            </div>
          </dl>
        </Block>
      </div>
    </div>
  );
}
