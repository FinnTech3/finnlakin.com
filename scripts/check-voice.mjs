import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

/* The site's copy has a house style: British spelling, and no em dashes.
   Content lives in typed TypeScript rather than markdown, so it gets edited
   like code, and style drifts the way code drifts. This catches that. */

const ROOTS = ["src/lib", "src/content"];

/* Other people's words. Correcting a quote to match a house style is editing
   what somebody said, so this file is out of scope on purpose: it holds the
   only em dash on the site, inside a testimonial, correctly. */
const EXEMPT = new Set(["src/lib/endorsements.ts"]);

/* Lookarounds keep these off hyphenated class names, so `text-center` and
   `bg-color-x` are not reported as American spelling. */
const boundary = (word) => new RegExp(`(?<![-\\w])${word}(?![-\\w])`, "gi");

const RULES = [
  { name: "em dash", pattern: /—/g, fix: "use a comma, a colon, or a full stop" },
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
    if (entry.isDirectory()) return walk(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
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
        const match = rule.pattern.exec(line);
        if (match) {
          problems.push(
            `${rel}:${index + 1}  ${rule.name}: "${match[0]}"  ->  ${rule.fix}`,
          );
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
