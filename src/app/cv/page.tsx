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
    <ol className="flex flex-col gap-9">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <h3 className="t-h3 text-ink">{entry.title}</h3>
            <span className="tnum text-[15px] text-muted">
              {entry.start} – {entry.end}
            </span>
          </div>
          <p className="text-[15px] text-muted">
            {entry.org} · {entry.location}
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-2 pl-5">
            {entry.points.map((point) => (
              <li
                key={point}
                className="max-w-[72ch] text-[16px] leading-relaxed text-ink-soft"
              >
                {point}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/* The two column rhythm the design reference asks for, doing real work here:
   the section name sits in the left column and the content runs beside it, so
   a wide screen is filled without a line of text ever getting longer than it
   should be. It collapses to one column below the large breakpoint, and to one
   column on paper, where a floating label would be wasted margin. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-16 gap-y-5 border-t border-rule pt-8 lg:grid-cols-[14rem_minmax(0,1fr)] print:block">
      <h2 className="t-label">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export default function CvPage() {
  return (
    <div className="cv-print shell w-full pt-6 pb-24 sm:pt-12">
      <header className="flex flex-col gap-5 pb-14">
        <h1 className="t-hlg max-w-[12ch] text-ink">{person.name}</h1>
        <p className="text-[18px] text-ink-soft">
          {person.course} · {person.university} · Class of {person.graduation}
        </p>
        <div className="flex flex-wrap gap-x-7 gap-y-2">
          <a href={`mailto:${contact.email}`} className="text-[15px] text-accent hover:underline">
            {contact.email}
          </a>
          <a href={contact.linkedin} className="text-[15px] text-accent hover:underline">
            linkedin.com/in/finnlakin
          </a>
          <a href={contact.github} className="text-[15px] text-accent hover:underline">
            github.com/FinnTech3
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <a
            href="/finn-lakin-cv.pdf"
            data-analytics-event="cv_download"
            className="pill pill-filled print-hidden min-h-11"
          >
            Download PDF
          </a>
        </div>
      </header>

      <div className="flex flex-col gap-12">
        <Block title="Profile">
          <p className="max-w-[72ch] text-[17px] leading-relaxed text-ink-soft">
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
          <dl className="flex flex-col gap-5">
            {skillGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                <dt className="t-label min-w-36">
                  {group.label}
                </dt>
                <dd className="text-[16px] text-ink-soft">
                  {group.items.join(" · ")}
                </dd>
              </div>
            ))}
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-6">
              <dt className="t-label min-w-36">
                Languages
              </dt>
              <dd className="text-[16px] text-ink-soft">
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
