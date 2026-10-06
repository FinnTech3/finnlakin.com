import Link from "next/link";
import { Archivo, Fragment_Mono } from "next/font/google";

import { buildMetadata } from "@/lib/metadata";
import styles from "./archive.module.css";

/* The three design directions, side by side, while one of them is chosen.

   They are not the site and they are not in it: not in the navigation, not in
   the sitemap, disallowed in robots and carrying noindex each. The site's own
   header, footer and dark stage are unmounted on these routes by SiteOnly, so
   each direction is looked at whole rather than through the current one's
   frame.

   The content is the same on all three, out of src/lib, unchanged. What differs
   is the paper, the type, the composition, and what the particle cloud is drawn
   in: light, ink, or two inks printed slightly out of register. */

export const metadata = buildMetadata({
  path: "/looks",
  title: "Three directions",
  description: "Three design directions for the site, to be looked at and chosen between.",
  noindex: true,
});

export const viewport = { themeColor: "#edeae3" };

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
});

const fragment = Fragment_Mono({
  variable: "--font-fragment",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const directions = [
  {
    href: "/looks/archive",
    number: "01",
    name: "Archive",
    line: "A fashion archive's catalogue crossed with a research ledger.",
    detail:
      "Bone paper, carbon ink, one hi-vis orange where a result did not hold. Each project is a numbered piece with a garment tag: what it is made of, what it measured, and how far the label can be trusted. The cloud is drawn in graphite on the paper.",
    surface: "Ink, one pigment",
  },
  {
    href: "/looks/print",
    number: "02",
    name: "Print room",
    line: "A risograph zine crossed with an annotated working paper.",
    detail:
      "Newsprint, two inks, and the misregistration a duplicator gives you for free. Findings are circled by hand in the margin the way somebody marks up a printout. The cloud is printed on both plates, slightly out of register.",
    surface: "Two inks, screened",
  },
  {
    href: "/looks/concrete",
    number: "03",
    name: "Concrete",
    line: "A brutalist surface crossed with a terminal.",
    detail:
      "Warm grey concrete, chalk, carbon, and one acid green. The name is set enormous and cropped by the edge of the screen, and the work is an index rather than a gallery. The cloud is chalk on the wall.",
    surface: "Ink, chalk pigments",
  },
];

export default function LooksIndex() {
  return (
    <div
      data-look="index"
      className={`${archivo.variable} ${fragment.variable} ${styles.look}`}
    >
      <div className="band-inner" style={{ paddingBlock: "clamp(4rem, 9vw, 7rem)" }}>
        <span className={styles.label}>Finn Lakin, design directions, 2026</span>
        <h1 className={`${styles.displaySm} mt-6 mb-6`}>Three directions</h1>
        <p className={`${styles.body} mb-14`}>
          The same work, the same numbers and the same words, in three different mediums. Look at
          each one whole, then pick the one that feels like you. Whichever wins gets built across
          every page; the other two are deleted.
        </p>

        <ol className="m-0 grid list-none gap-0 p-0">
          {directions.map((direction) => (
            <li key={direction.href} className={styles.piece}>
              <div className={styles.pieceNo}>{direction.number}</div>
              <div>
                <h2 className={styles.pieceName}>
                  <Link className={styles.link} href={direction.href}>
                    {direction.name}
                  </Link>
                </h2>
                <p className={`${styles.pieceFinding} mb-3`}>{direction.line}</p>
                <p className={`${styles.body} text-[0.9375rem]`}>{direction.detail}</p>
              </div>
              <div className={styles.tag}>
                <div className={styles.tagRow}>
                  <span className={styles.label}>Cloud</span>
                  <span className={styles.tagValue}>{direction.surface}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className={`${styles.label} ${styles.rule} mt-16 pt-6`}>
          None of these is the live site. <Link className={styles.link} href="/">The current one is here.</Link>
        </p>
      </div>
    </div>
  );
}
