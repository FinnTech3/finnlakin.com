import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

/* The site's copy has a house style: British spelling, and no em dashes.
   Content lives in typed TypeScript rather than markdown, so it gets edited
   like code, and style drifts the way code drifts. This catches that. */

/* Everything that renders or generates copy. This used to be src/lib and
   src/content only, which meant the components and the pages were never
   checked: the CV page and the timeline were both printing an em dash in a
   date range, sixteen of them reached the built home page, and the generator
   put more into the PDF. A guard that does not cover the files that produce
   the output is not a guard. scripts is here because build-cv-pdf.ts writes
   copy into a document nobody re-reads. */
const ROOTS = ["src", "scripts"];

/* Test fixtures deliberately contain bad style. */
const SKIP_DIRS = new Set(["node_modules", ".next"]);

/* Other people's words. Correcting a quote to match a house style is editing
   what somebody said, so this file is out of scope on purpose: it holds the
   only em dash on the site, inside a testimonial, correctly. */
const EXEMPT = new Set([
  "src/lib/endorsements.ts",
  /* This file names every spelling it rejects, so it fails itself. */
  "scripts/check-voice.mjs",
]);

/* Lookarounds keep these off hyphenated class names, so `text-center` and
   `bg-color-x` are not reported as American spelling.

   The group around the alternation is load-bearing. Without it `|` binds
   looser than the lookahead, so `colors?|colored` compiled to
   "(?<!...)colors?" OR "colored(?!...)" and the first branch had no trailing
   boundary at all: it matched the `colorS` inside `colorScheme`. That went
   unnoticed while the check only ran over src/lib and src/content, where no
   CSS property names appear. */
const boundary = (word) => new RegExp(`(?<![-\\w])(?:${word})(?![-\\w])`, "gi");

/* A CSS property name or a CSS value is not prose and cannot be spelled the
   British way: `color:` and `"center"` are part of the platform. Skipping them
   is narrow on purpose, keyed on the punctuation around the match rather than
   on a list of allowed words, and it never applies to the em dash rule, where
   being inside a string is exactly where the problem shows up. */
function isPlatformSpelling(line, index, length) {
  const before = line.slice(0, index);
  const after = line.slice(index + length);
  if (/^\s*[:=]/.test(after)) return true;
  return /["'`]$/.test(before) && /^["'`]/.test(after);
}

const RULES = [
  { name: "em dash", pattern: /—/g, fix: "use a comma, a colon, or a full stop", prose: false },
  { name: "analyze", pattern: boundary("analyz\\w*"), fix: "analyse" },
  { name: "optimize", pattern: boundary("optimiz\\w*"), fix: "optimise" },
  { name: "organize", pattern: boundary("organiz\\w*"), fix: "organise" },
  { name: "recognize", pattern: boundary("recogniz\\w*"), fix: "recognise" },
  { name: "behavior", pattern: boundary("behaviors?"), fix: "behaviour" },
  { name: "color", pattern: boundary("colors?|colored"), fix: "colour" },
  { name: "favorite", pattern: boundary("favou?rite\\w*|favors?"), fix: "favourite, favour" },
  { name: "center", pattern: boundary("centers?|centered"), fix: "centre, centred" },
  { name: "defense", pattern: boundary("defense"), fix: "defence" },
  { name: "modeling", pattern: boundary("modeling|modeled"), fix: "modelling, modelled" },
  { name: "traveled", pattern: boundary("traveled|traveling"), fix: "travelled, travelling" },
  { name: "canceled", pattern: boundary("canceled"), fix: "cancelled" },
  { name: "fulfill", pattern: boundary("fulfill"), fix: "fulfil" },
  { name: "judgment", pattern: boundary("judgment"), fix: "judgement" },
  { name: "gray", pattern: boundary("gray"), fix: "grey" },
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) ? [] : walk(path);
    }
    return [".ts", ".tsx", ".mjs"].includes(extname(entry.name)) ? [path] : [];
  });
}

const problems = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file);
    if (EXEMPT.has(rel)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        rule.pattern.lastIndex = 0;
        for (const match of line.matchAll(rule.pattern)) {
          const spelling = rule.prose !== false;
          if (spelling && isPlatformSpelling(line, match.index, match[0].length)) {
            continue;
          }
          problems.push(
            `${rel}:${index + 1}  ${rule.name}: "${match[0]}"  ->  ${rule.fix}`,
          );
          break;
        }
      }
    });
  }
}

if (problems.length > 0) {
  console.error("House style:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    `\n${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
      "British spelling, and no em dashes.\n",
  );
  process.exit(1);
}

console.log("House style: clean.");
