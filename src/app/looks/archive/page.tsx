import { Archivo, Fragment_Mono, Instrument_Serif } from "next/font/google";

import { LookBrain } from "@/components/look-brain";
import { provenanceShort } from "@/lib/claims";
import { endorsements } from "@/lib/endorsements";
import { buildMetadata } from "@/lib/metadata";
import { projects } from "@/lib/projects";
import { reconstructions } from "@/lib/reconstructions";
import { contact, person } from "@/lib/site";
import { languages, skillGroups } from "@/lib/skills";
import { timeline } from "@/lib/timeline";
import styles from "../archive.module.css";

/* Direction 01 of three. See looks/page.tsx for what these are and why they
   are not the site.

   Every figure, name and date on this page comes out of src/lib, unchanged.
   The direction is the medium and the composition, and nothing else: a mockup
   that invented a number to fill a column would be showing a design for a
   different person's work. */

export const metadata = buildMetadata({
  path: "/looks/archive",
  title: "Direction 01, Archive",
  description: "A design direction: an archive catalogue and a research ledger, on bone paper.",
  noindex: true,
});

export const viewport = { themeColor: "#edeae3" };

/* One grotesk with a width axis, used at both ends of it: squeezed for the
   headlines, opened out for the labels. A tag on a garment and a column head in
   a table are the same typography, which is the whole argument of this
   direction, so they are set in the same face. */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

/* One line on the page is in a voice rather than a specification. It gets a
   serif, italic, and it is the only one. */
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

const fragment = Fragment_Mono({
  variable: "--font-fragment",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/* The cloud, in graphite on bone. Pale where it is thin and near black where it
   piles up, so it reads as a drawing rather than as a photograph of a light. */
const surface = {
  kind: "ink",
  pale: "#8d8a83",
  deep: "#141414",
  gain: 6.5,
} as const;

const studio = [
  { id: "paint", label: "Painting and drawing" },
  { id: "photo", label: "Photography and film" },
  { id: "spatial", label: "3D and code" },
  { id: "graphic", label: "Graphic design" },
  { id: "archive", label: "Archive and fashion" },
];

function Tag({ rows }: { rows: { label: string; value: string; flag?: boolean }[] }) {
  return (
    <dl className={styles.tag}>
      {rows.map((row) => (
        <div key={row.label} className={styles.tagRow}>
          <dt className={styles.label}>{row.label}</dt>
          <dd className={`${styles.tagValue} ${row.flag ? styles.flag : ""}`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ArchiveLook() {
  const held = reconstructions.filter((row) => row.tone === "pass").length;

  return (
    <div data-look="archive" className={`${archivo.variable} ${instrument.variable} ${fragment.variable} ${styles.look}`}>
      <LookBrain surface={surface} />

      <section id="hero" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className={`${styles.crop} pt-6 pb-10`}>
            <div className="flex flex-wrap items-baseline justify-between gap-4 pt-4">
              <span className={styles.label}>Finn Lakin, archive 2026</span>
              <span className={`${styles.mono}`}>FL / OXFORD / CLASS OF {person.graduation}</span>
            </div>
          </div>

          <h1 className={styles.display}>
            Finn
            <br />
            Lakin
          </h1>

          <div className={`${styles.rule} mt-10 grid gap-8 pt-8 md:grid-cols-[minmax(0,1fr)_16rem]`}>
            <div>
              <p className={`${styles.serif} mb-6`}>
                I rebuild published numbers from primitives and report the gap. Sometimes the gap is
                the finding.
              </p>
              <p className={styles.body}>
                Economics and finance, software, and a camera. The same habit runs through all
                three: take the finished thing apart, find out what it is actually made of, and
                keep a record of the answer.
              </p>
            </div>
            <Tag
              rows={[
                { label: "Reading", value: person.course },
                { label: "At", value: person.university },
                { label: "Year", value: `Graduating ${person.graduation}` },
                { label: "Status", value: "Available Summer 2026" },
              ]}
            />
          </div>

          <div className="brain-slot" data-brain-slot="" aria-hidden="true" />
        </div>
      </section>

      <section id="work" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className={styles.displaySm}>The pieces</h2>
            <span className={styles.label}>{projects.length} entries, strongest evidence first</span>
          </div>

          {projects.map((project, index) => (
            <article key={project.slug} className={styles.piece}>
              <div className={styles.pieceNo}>
                FL&#8209;{String(index + 1).padStart(3, "0")}
              </div>
              <div>
                <h3 className={styles.pieceName}>{project.name}</h3>
                <p className={styles.pieceFinding}>{project.headline}</p>
              </div>
              <Tag
                rows={[
                  { label: "Materials", value: project.stack },
                  { label: "Measure", value: project.stats[0]?.value ?? "" },
                  {
                    label: "Reads",
                    value: project.stats[0]?.label ?? "",
                    flag: project.stats[0]?.tone === "flag",
                  },
                  { label: "Care", value: provenanceShort[project.provenance] },
                ]}
              />
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad} ${styles.hairline}`}>
          <h2 className={styles.displaySm}>
            Four rebuilt. {held} held.
          </h2>
          <p className={`${styles.body} mt-4 mb-10`}>
            Four published quantities, rebuilt from primitives and checked against the source. The
            fourth row is the point of the table: the same model that pins the yield curve down
            cannot pin down the premium it draws from it.
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
                  <td className={row.tone === "flag" ? styles.flag : undefined}>{row.deviation}</td>
                  <td className={row.tone === "flag" ? styles.flag : undefined}>{row.verdict}</td>
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
            <div key={entry.id} className={`${styles.piece} md:grid-cols-[9rem_minmax(0,1fr)]`}>
              <div className={styles.pieceNo}>
                {entry.start}
                <br />
                {entry.end}
              </div>
              <div>
                <h3 className={`${styles.pieceName} text-[1.25rem] md:text-[1.5rem]`}>
                  {entry.title}
                </h3>
                <div className={`${styles.label} ${styles.labelInk} mb-3`}>
                  {entry.org}, {entry.location}
                </div>
                <p className={styles.pieceFinding}>{entry.points[0]}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="skills" className="band-lane-left">
        <div className={`band-inner ${styles.sectionPad} ${styles.hairline}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Materials</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {skillGroups.map((group) => (
              <div key={group.id}>
                <div className={`${styles.label} ${styles.labelInk} mb-3`}>{group.label}</div>
                <ul className={`${styles.mono} grid gap-1.5`}>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className={`${styles.stitch} mt-8 pt-6`}>
            <div className={`${styles.label} ${styles.labelInk} mb-3`}>Languages</div>
            <ul className={`${styles.mono} flex flex-wrap gap-x-10 gap-y-2`}>
              {languages.map((language) => (
                <li key={language.name}>
                  {language.name}, {language.level}
                </li>
              ))}
            </ul>
          </div>

          <div className={`${styles.rule} mt-14 pt-8`}>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <h3 className={styles.displaySm}>The studio</h3>
              <span className={styles.label}>Five rooms, none photographed yet</span>
            </div>
            <p className={`${styles.body} mb-8`}>
              The other half of the same habit. These frames stay empty until there is work in them
              worth printing, because a catalogue that fills its plates with somebody else&rsquo;s
              pictures is a catalogue of nothing.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {studio.map((room, index) => (
                <div key={room.id} className={styles.slot}>
                  <span className={styles.slotEmpty}>
                    ST&#8209;{String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={`${styles.label} ${styles.labelInk}`}>{room.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="endorsements" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad}`}>
          <h2 className={`${styles.displaySm} mb-8`}>On the record</h2>
          <div className="grid gap-12 lg:grid-cols-2">
            {endorsements.map((quote) => (
              <figure key={quote.id} className="m-0">
                <blockquote className={styles.quote}>{quote.quote}</blockquote>
                <figcaption className={`${styles.label} ${styles.labelInk} mt-4`}>
                  {quote.name}, {quote.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="band-lane-right">
        <div className={`band-inner ${styles.sectionPad} ${styles.hairline}`}>
          <h2 className={`${styles.displaySm} mb-8`}>Open to Summer 2026 conversations</h2>
          <div className={`${styles.mono} grid gap-3`}>
            <a className={styles.link} href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
            <a className={styles.link} href={contact.linkedin}>
              linkedin.com/in/finnlakin
            </a>
            <a className={styles.link} href={contact.github}>
              github.com/FinnTech3
            </a>
          </div>
          <div className={`${styles.rule} ${styles.label} mt-16 pt-6`}>
            Direction 01 of 3, Archive. Not the site.
          </div>
        </div>
      </section>
    </div>
  );
}
