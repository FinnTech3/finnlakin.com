import { Big_Shoulders, Martian_Mono } from "next/font/google";

import { LookBrain } from "@/components/look-brain";
import { provenanceShort } from "@/lib/claims";
import { endorsements } from "@/lib/endorsements";
import { buildMetadata } from "@/lib/metadata";
import { projects } from "@/lib/projects";
import { reconstructions } from "@/lib/reconstructions";
import { contact, person } from "@/lib/site";
import { languages, skillGroups } from "@/lib/skills";
import { timeline } from "@/lib/timeline";
import styles from "../concrete.module.css";

/* Direction 03 of three. See looks/page.tsx.

   Every figure and name comes out of src/lib unchanged. This direction does the
   least to them: the work is listed rather than presented, on the argument that
   a list with a verdict column is more confident than a page of cards. */

export const metadata = buildMetadata({
  path: "/looks/concrete",
  title: "Direction 03, Concrete",
  description: "A design direction: a brutalist wall and a terminal, in warm concrete grey.",
  noindex: true,
});

export const viewport = { themeColor: "#a7a39b" };

const shoulders = Big_Shoulders({
  variable: "--font-shoulders",
  subsets: ["latin"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

/* Chalk on the wall. The same ink reading as the archive direction with its
   pigments turned the other way up: pale where the cloud is thin, near white
   where it piles up. Over a mid grey page that reads as chalk dust, which is
   the one medium that suits a wall. */
const surface = {
  kind: "ink",
  pale: "#cfccc4",
  deep: "#f6f4f0",
  gain: 5.2,
} as const;

const bays = [
  "Painting, drawing",
  "Photography, film",
  "3D, code",
  "Graphic design",
  "Archive, fashion",
];

export default function ConcreteLook() {
  const held = reconstructions.filter((row) => row.tone === "pass").length;

  return (
    <div
      data-look="concrete"
      className={`${shoulders.variable} ${martian.variable} ${styles.look}`}
    >
      <LookBrain surface={surface} />

      <section id="hero" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <span className={styles.label}>Finn Lakin / Oxford / Available Summer 2026</span>
            <span className={styles.label}>Index 01 to {projects.length}</span>
          </div>

          {/* Cropped by the edge on purpose: a name that runs off the screen
              reads as larger than the screen. The overflow is hidden on the
              section rather than the page, so nothing scrolls sideways. */}
          <div className={styles.crop}>
            <h1 className={styles.display}>
              Finn
              <br />
              Lakin
            </h1>
          </div>

          <div className={`${styles.scored} mt-8 grid gap-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}>
            <p className={styles.lede}>
              I rebuild published numbers from primitives and report the gap
            </p>
            <div>
              <p className={`${styles.body} mb-4`}>
                Sometimes the gap is the finding. Economics, finance and software on one side;
                film, print, drawing and clothes on the other. It is one habit either way: take the
                finished thing apart, work out what it is made of, and write down what you found.
              </p>
              <p className={styles.label}>
                {person.course}, {person.university}. Graduating {person.graduation}.
              </p>
            </div>
          </div>

          <div className="brain-slot" data-brain-slot="" aria-hidden="true" />
        </div>
      </section>

      <section id="work" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Index</h2>
          {/* A region that can scroll has to be reachable without a pointer, or
              a keyboard user at phone width cannot read its right-hand columns:
              focusable, and named so it is announced as something. */}
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Index of work">
            <table className={styles.index}>
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">Piece</th>
                <th scope="col">Figure</th>
                <th scope="col">Built with</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project, index) => {
                const stat = project.stats[0];
                return (
                  <tr key={project.slug}>
                    <td className={styles.num}>{String(index + 1).padStart(2, "0")}</td>
                    <td>
                      <span className={styles.indexName}>{project.name}</span>
                      <div className="mt-1.5 max-w-[46ch]">{project.headline}</div>
                    </td>
                    <td className={styles.figure}>
                      {stat?.tone === "flag" ? (
                        <span className={styles.flag}>{stat.value}</span>
                      ) : (
                        (stat?.value ?? "")
                      )}
                    </td>
                    <td>{project.stack}</td>
                    <td>{provenanceShort[project.provenance]}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="about" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className={styles.chalkBlock}>
            <h2 className={`${styles.displaySm} ${styles.displayChalk} mb-4`}>
              Four rebuilt. {held} held.
            </h2>
            <p className={`${styles.body} mb-8`}>
              Four published quantities, rebuilt from primitives and checked against the source. The
              last row is the point of the table: the same model that pins the yield curve down
              cannot pin down the premium it draws out of it.
            </p>
            <div
              className={styles.tableWrap}
              tabIndex={0}
              role="region"
              aria-label="The four reconstructions"
            >
              <table className={styles.index}>
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
                    <td className={styles.figure}>
                      {row.tone === "flag" ? (
                        <span className={styles.flag}>{row.deviation}</span>
                      ) : (
                        row.deviation
                      )}
                    </td>
                    <td>
                      {row.tone === "flag" ? (
                        <span className={styles.flag}>{row.verdict}</span>
                      ) : (
                        row.verdict
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="path" className="band-lane-left">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Record</h2>
          {timeline.map((entry) => (
            <div
              key={entry.id}
              className={`${styles.scoredThin} grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8`}
            >
              <div className={styles.label}>
                {entry.start} to {entry.end}
              </div>
              <div>
                <h3 className={`${styles.indexName} m-0`}>{entry.title}</h3>
                <div className={`${styles.label} mt-1 mb-2`}>
                  {entry.org}, {entry.location}
                </div>
                <p className={`${styles.body} m-0`}>{entry.points[0]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="skills" className="band-lane-left">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Held</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {skillGroups.map((group) => (
              <div key={group.id}>
                <div className={`${styles.label} ${styles.scored} mb-3 pt-2`}>{group.label}</div>
                <ul className="grid gap-1.5">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={`${styles.scoredThin} mt-8 pt-5`}>
            <span className={styles.label}>Languages</span>
            <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              {languages.map((language) => (
                <li key={language.name}>
                  {language.name}, {language.level}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.scored} mt-14 pt-6`}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
              <h3 className={styles.displaySm}>Bays</h3>
              <span className={styles.label}>Five cut, none filled</span>
            </div>
            <p className={`${styles.body} mb-8`}>
              Space held for the other half of the work: the pictures, the prints, the clothes.
              Empty until there is something of mine to put in it, because a wall hung with stock
              images is an advertisement for stock images.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {bays.map((bay, index) => (
                <div key={bay} className={styles.bay}>
                  <span className={styles.bayNo}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.label}>{bay}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="endorsements" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>On record</h2>
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
          <ul className="grid gap-4">
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
          <div className={`${styles.scored} ${styles.label} mt-16 pt-4`}>
            Direction 03 of 3, Concrete. Not the site.
          </div>
        </div>
      </section>
    </div>
  );
}
