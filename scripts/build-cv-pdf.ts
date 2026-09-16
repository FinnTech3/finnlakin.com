import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { contact, person } from "../src/lib/site";
import { languages, skillGroups } from "../src/lib/skills";
import { timeline } from "../src/lib/timeline";

/* Generated from the same typed content as the site, so the CV and the site
   cannot drift apart. Helvetica rather than the site's IBM Plex: this file
   exists to be parsed by applicant tracking systems and read by screen
   readers, and an embedded font buys nothing there while risking both. */

const INK = "#15171a";
const MUTED = "#5c6167";
const RULE = "#c9c9c1";
const MARGIN = 54;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(out, { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margin: MARGIN,
  /* lang so a screen reader announces the document in English instead of
     guessing from the reader's locale, and Keywords because an applicant
     tracking system reads them. The text layer itself is already extractable:
     base-14 fonts under WinAnsiEncoding, so no glyph subsetting and no
     ToUnicode map to get wrong. */
  lang: "en-GB",
  info: {
    Title: `${person.name} · Curriculum Vitae`,
    Author: person.name,
    Subject: person.course,
    Keywords: [
      person.course,
      person.university,
      "equity research",
      "quantitative methods",
      "financial technology",
      "Python",
      "R",
      "Rust",
      "TypeScript",
      "SQL",
    ].join(", "),
  },
});

doc.pipe(createWriteStream(join(out, "finn-lakin-cv.pdf")));

const width = doc.page.width - MARGIN * 2;

function rule(gap = 10) {
  doc.moveDown(gap / 14);
  const y = doc.y;
  doc.save().strokeColor(RULE).lineWidth(0.5).moveTo(MARGIN, y).lineTo(MARGIN + width, y).stroke().restore();
  doc.y = y + 10;
}

function sectionTitle(label: string) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(MUTED)
    .text(label.toUpperCase(), { characterSpacing: 1.2 });
  doc.moveDown(0.5);
}

function entry(title: string, org: string, location: string, dates: string, points: string[]) {
  const top = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(title, { width: width - 110 });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text(dates, MARGIN, top + 1, { width, align: "right" });

  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`${org} · ${location}`, MARGIN, doc.y, {
    width,
  });
  doc.moveDown(0.35);

  for (const point of points) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(INK)
      .text(`•  ${point}`, MARGIN + 8, doc.y, { width: width - 8, lineGap: 1.5 });
    doc.moveDown(0.2);
  }
  doc.moveDown(0.7);
}

doc.font("Helvetica-Bold").fontSize(22).fillColor(INK).text(person.name);
doc.moveDown(0.25);
doc
  .font("Helvetica")
  .fontSize(9.5)
  .fillColor(MUTED)
  .text(`${person.course} · ${person.university} · Class of ${person.graduation}`);
doc.moveDown(0.15);
doc
  .font("Helvetica")
  .fontSize(9.5)
  .fillColor(MUTED)
  .text(`${contact.email}  ·  linkedin.com/in/finnlakin  ·  github.com/FinnTech3`);

rule(14);

sectionTitle("Profile");
doc
  .font("Helvetica")
  .fontSize(9.5)
  .fillColor(INK)
  .text(
    `Final-year ${person.course} student at ${person.university}, on track for First-Class Honours, back from an exchange year at ${person.exchange} taught in French. I rebuild published financial and economic series from primitives and report where the reconstruction disagrees, in Python, R, Rust and TypeScript. Seeking ${person.seeking}.`,
    { width, lineGap: 1.5 },
  );

rule();

sectionTitle("Experience");
for (const item of timeline.filter((t) => t.kind === "work")) {
  entry(item.title, item.org, item.location, `${item.start} – ${item.end}`, item.points);
}

rule();

sectionTitle("Education");
for (const item of timeline.filter((t) => t.kind === "education")) {
  entry(item.title, item.org, item.location, `${item.start} – ${item.end}`, item.points);
}

rule();

sectionTitle("Skills");
for (const group of skillGroups) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(`${group.label}: `, { continued: true });
  doc.font("Helvetica").fillColor(INK).text(group.items.join(" · "), { width, lineGap: 1 });
  doc.moveDown(0.25);
}
doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Languages: ", { continued: true });
doc
  .font("Helvetica")
  .fillColor(INK)
  .text(languages.map((l) => `${l.name}, ${l.level.toLowerCase()}`).join(" · "), { width });

doc.end();

console.log("Wrote public/finn-lakin-cv.pdf");
