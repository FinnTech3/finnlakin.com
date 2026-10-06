import { Space_Mono, Syne } from "next/font/google";

import { LookBrain } from "@/components/look-brain";
import { provenanceShort } from "@/lib/claims";
import { endorsements } from "@/lib/endorsements";
import { buildMetadata } from "@/lib/metadata";
import { projects } from "@/lib/projects";
import { reconstructions } from "@/lib/reconstructions";
import { contact, person } from "@/lib/site";
import { languages, skillGroups } from "@/lib/skills";
import { timeline } from "@/lib/timeline";
import styles from "../print.module.css";

/* Direction 02 of three. See looks/page.tsx.

   Every figure and name comes out of src/lib unchanged. What this direction
   adds is the marking up: a ring drawn round the number that carries each
   finding, and a note in the margin next to it. */

export const metadata = buildMetadata({
  path: "/looks/print",
  title: "Direction 02, Print room",
  description: "A design direction: a two ink risograph zine, marked up by hand.",
  noindex: true,
});

export const viewport = { themeColor: "#f2eee4" };

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

/* Two plates on newsprint. The offset is in uv, so about two pixels at this
   canvas size: a duplicator misses by roughly that much and the eye reads it
   as a print rather than as a fault. */
const surface = {
  kind: "riso",
  paper: "#f2eee4",
  inkA: "#0078bf",
  inkB: "#ff6c2f",
  gain: 5.5,
  offset: [0.0022, 0.0028],
  cell: 3.2,
  depth: 0.55,
} as const;

const studio = [
  { id: "paint", label: "Painting, drawing", tilt: "-1.2deg" },
  { id: "photo", label: "Photography, film", tilt: "0.8deg" },
  { id: "spatial", label: "3D, code", tilt: "-0.6deg" },
  { id: "graphic", label: "Graphic design", tilt: "1.4deg" },
  { id: "archive", label: "Archive, fashion", tilt: "-1deg" },
];

/* A ring round a number, drawn once and stretched. Two strokes, because
   somebody going round a number twice is what the gesture actually is. */
function Ringed({ children }: { children: string }) {
  return (
    <span className={styles.ringed}>
      <svg className={styles.ring} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M8 20C8 9 27 4 52 4c24 0 42 5 42 15 0 11-19 17-43 17C27 36 8 31 8 20Z"
          fill="none"
          stroke="#ff6c2f"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M11 22C11 12 29 7 53 6.5c23-.5 40 5 40 14"
          fill="none"
          stroke="#ff6c2f"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          opacity="0.65"
        />
      </svg>
      {children}
    </span>
  );
}

export default function PrintLook() {
  const held = reconstructions.filter((row) => row.tone === "pass").length;

  return (
    <div
      data-look="print"
      className={`${syne.variable} ${spaceMono.variable} ${styles.look}`}
    >
      <LookBrain surface={surface} />

      <section id="hero" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <span className={styles.stamp}>Issue 01</span>
            <span className={`${styles.stamp} ${styles.stampBlue}`}>Oxford, 2026</span>
            <span className={styles.label}>Two inks, one duplicator</span>
          </div>

          <h1 className={styles.display}>
            <span className={styles.displayGhost} aria-hidden="true">
              Finn Lakin
            </span>
            Finn Lakin
          </h1>

          <div className={`${styles.printedRule} mt-10 grid gap-10 pt-8 md:grid-cols-2`}>
            <p className={styles.lede}>
              I rebuild published numbers from primitives and report the gap. Sometimes the gap is
              the finding.
            </p>
            <div>
              <p className={`${styles.body} mb-4`}>
                Economics and finance, software, and the making side: film, print, drawing, the
                clothes. All of it is the same move. Pull the finished thing apart, find out what it
                is really made of, and keep the receipts either way.
              </p>
              <p className={styles.label}>
                {person.course}, {person.university}. Graduating {person.graduation}. Available
                Summer 2026.
              </p>
            </div>
          </div>

          <div className="brain-slot" data-brain-slot="" aria-hidden="true" />
        </div>
      </section>

      <section id="work" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className={styles.displaySm}>The work, marked up</h2>
            <span className={styles.label}>{projects.length} pieces, hardest evidence first</span>
          </div>

          {projects.map((project, index) => {
            const stat = project.stats[0];
            return (
              <article key={project.slug} className={styles.spread}>
                <div className={styles.spreadNo}>{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3 className={styles.spreadName}>{project.name}</h3>
                  <p className={styles.finding}>{project.headline}</p>
                  {stat ? (
                    <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                      <Ringed>{stat.value}</Ringed>
                      <span className={styles.marginNote}>{stat.label}</span>
                    </p>
                  ) : null}
                  <div className={styles.meta}>
                    <span>{project.stack}</span>
                    <span>{provenanceShort[project.provenance]}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-4`}>Four rebuilt. {held} held.</h2>
          <p className={`${styles.body} mb-10`}>
            Four published quantities, rebuilt from primitives and checked against the source. The
            last row is the point: the same model that pins the yield curve down cannot pin down
            the premium it draws out of it.
          </p>
          {/* Scrolls inside itself when it must, and is reachable without a
              pointer when it does: a table is as wide as its content, and the
              page is not allowed to be. */}
          <div
            className={styles.tableWrap}
            tabIndex={0}
            role="region"
            aria-label="The four reconstructions"
          >
          <table className={styles.ledger}>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Against</th>
                <th scope="col">Deviation</th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {reconstructions.map((row) => (
                <tr key={row.projectSlug}>
                  <td>
                    {row.quantity}
                    <div className={`${styles.label} mt-1`}>{row.detail}</div>
                  </td>
                  <td>{row.reference}</td>
                  <td className={row.tone === "flag" ? styles.flag : styles.pass}>
                    {row.deviation}
                  </td>
                  <td className={row.tone === "flag" ? styles.flag : styles.pass}>{row.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      <section id="path" className="band-lane-left">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Where I have been</h2>
          {timeline.map((entry) => (
            <div key={entry.id} className={`${styles.spread} ${styles.spreadDated}`}>
              <div className={`${styles.label} pt-1`}>
                {entry.start}
                <br />
                {entry.end}
              </div>
              <div>
                <h3 className={styles.spreadName}>{entry.title}</h3>
                <div className={`${styles.label} mb-3`}>
                  {entry.org}, {entry.location}
                </div>
                <p className={styles.finding}>{entry.points[0]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="skills" className="band-lane-left">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Kit</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {skillGroups.map((group) => (
              <div key={group.id}>
                <div className="mb-3">
                  <span className={`${styles.stamp} ${styles.stampBlue}`}>{group.label}</span>
                </div>
                <ul className="grid gap-1.5 text-[0.8125rem]">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={`${styles.thinRule} mt-8 pt-6`}>
            <span className={styles.label}>Languages</span>
            <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[0.8125rem]">
              {languages.map((language) => (
                <li key={language.name}>
                  {language.name}, {language.level}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.printedRule} mt-14 pt-8`}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
              <h3 className={styles.displaySm}>Plates to come</h3>
              <span className={styles.label}>Five empty, nothing faked</span>
            </div>
            <p className={`${styles.body} mb-8`}>
              The other half of the work goes here: the pictures, the prints, the clothes. Empty
              until there is something of mine to put in them. A zine full of somebody else&rsquo;s
              images is somebody else&rsquo;s zine.
            </p>
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {studio.map((plate) => (
                <div
                  key={plate.id}
                  className={styles.taped}
                  style={{ ["--tilt" as string]: plate.tilt }}
                >
                  <span className={styles.tape} aria-hidden="true" />
                  <span className={styles.label}>{plate.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="endorsements" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Said about the work</h2>
          <div className="grid gap-10 lg:grid-cols-2">
            {endorsements.map((quote) => (
              <figure key={quote.id} className="m-0">
                <blockquote className={styles.quote}>{quote.quote}</blockquote>
                <figcaption className={`${styles.label} mt-4`}>
                  {quote.name}, {quote.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-6`}>Open to Summer 2026</h2>
          <ul className="grid gap-3 text-[0.9375rem]">
            <li>
              <a className={styles.link} href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </li>
            <li>
              <a className={styles.link} href={contact.linkedin}>
                linkedin.com/in/finnlakin
              </a>
            </li>
            <li>
              <a className={styles.link} href={contact.github}>
                github.com/FinnTech3
              </a>
            </li>
          </ul>
          <div className={`${styles.printedRule} ${styles.label} mt-16 pt-6`}>
            Direction 02 of 3, Print room. Not the site.
          </div>
        </div>
      </section>
    </div>
  );
}
