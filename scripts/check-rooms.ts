import { readFileSync } from "node:fs";
import { join } from "node:path";
import { acid, carbon, chalk } from "../src/lib/colours";
import {
  cream,
  hexToRgb,
  homeRoom,
  roomOfShape,
  rooms,
  type Rgb,
  type RoomName,
} from "../src/lib/rooms";
import { SHAPE_NAMES } from "../src/particles/structures";

/* Proves the rooms hold: that every one of them is somewhere type can be read,
   and that the table the cloud is tinted from and the stylesheet the page is
   painted from say the same thing.

   There are seven walls and one rule for all of them, which is only a rule if
   somebody checks it. A wall is easy to move by eye, and a wall that moves a
   few shades lighter looks the same in a screenshot and fails a reader with a
   weak display. The numbers here are worked out, not eyeballed: the ratio of
   each step of type to each wall, with cream laid over the wall at its alpha
   as the browser does it, against the thresholds the design asks for. Small
   type needs 4.5 to 1 and the quiet steps are held well above it.

   The second half is the drift. The room table is in lib/rooms.ts because the
   cloud cannot read a stylesheet, and the stylesheet has the same table
   because the page cannot read a module. They are two copies of one thing, and
   this reads the stylesheet back and fails if they differ, the same way
   tests/platform.spec.ts holds the theme colour to the wall.

   Runs in npm run lint, so it is enforced rather than available. */

let failures = 0;
function check(condition: boolean, description: string, detail = "") {
  if (condition) return;
  failures += 1;
  console.error(`  FAIL  ${description}${detail ? `: ${detail}` : ""}`);
}

/* WCAG 2.x relative luminance and contrast ratio. */
function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/* A colour laid over another at an alpha, as the browser composites it. */
function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((i) => top[i]! * alpha + under[i]! * (1 - alpha)) as Rgb;
}

const CREAM = hexToRgb(cream);
const ACID = hexToRgb(acid);
const CARBON = hexToRgb(carbon);
const CHALK = hexToRgb(chalk);

/* The stylesheet, read back. */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function property(block: string, name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

/* The alphas the page's text steps are written at, from the stylesheet's own
   :root block, so the check is of what ships and not of numbers typed here. */
const rootBlock = /:root\s*{([^}]*)}/.exec(css)?.[1] ?? "";
function alphaOf(block: string, name: string): number {
  const value = property(block, name);
  const match = value ? /\/\s*([0-9.]+)\s*\)/.exec(value) : null;
  return match ? Number(match[1]) : Number.NaN;
}

const steps = {
  ink: 1,
  "ink-soft": alphaOf(rootBlock, "--ink-soft"),
  muted: alphaOf(rootBlock, "--muted"),
  faint: alphaOf(rootBlock, "--faint"),
};
const glassAlpha = alphaOf(rootBlock, "--glass");

for (const [step, alpha] of Object.entries(steps)) {
  check(Number.isFinite(alpha) && alpha > 0 && alpha <= 1, `--${step} has an alpha in the stylesheet`);
}
check(Number.isFinite(glassAlpha), "--glass has an alpha in the stylesheet");

/* What each step must reach on the bare wall, and on glass over it. */
const FLOOR_WALL = { ink: 10, "ink-soft": 8, muted: 5.1, faint: 5 } as const;
const FLOOR_GLASS = { ink: 9, "ink-soft": 7, muted: 4.5, faint: 4.5 } as const;

const names = Object.keys(rooms) as RoomName[];
const worst: Record<string, { value: number; room: string }> = {};
function note(label: string, value: number, room: string) {
  if (!worst[label] || value < worst[label]!.value) worst[label] = { value, room };
}

for (const name of names) {
  const room = rooms[name];
  const wall = hexToRgb(room.wall);
  const tone = hexToRgb(room.tone);
  const glass = over(CREAM, glassAlpha, wall);

  for (const step of Object.keys(steps) as (keyof typeof steps)[]) {
    const alpha = steps[step];
    const onWall = ratio(over(CREAM, alpha, wall), wall);
    note(`${step} on the wall`, onWall, name);
    check(onWall >= FLOOR_WALL[step], `${name}: ${step} on the wall`, `${onWall.toFixed(2)}, wants ${FLOOR_WALL[step]}`);

    const onGlass = ratio(over(CREAM, alpha, glass), glass);
    note(`${step} on glass`, onGlass, name);
    check(onGlass >= FLOOR_GLASS[step], `${name}: ${step} on glass`, `${onGlass.toFixed(2)}, wants ${FLOOR_GLASS[step]}`);
  }

  /* The tone is used for small text: a numeral, an eyebrow. So it is held to
     the same 4.5 as any other small text, and on glass as well as the wall. */
  const toneOnWall = ratio(tone, wall);
  note("tone on the wall", toneOnWall, name);
  check(toneOnWall >= 4.5, `${name}: the tone on the wall`, `${toneOnWall.toFixed(2)}`);
  const toneOnGlass = ratio(tone, glass);
  check(toneOnGlass >= 4.5, `${name}: the tone on glass`, `${toneOnGlass.toFixed(2)}`);

  /* Acid is a link, a highlight and a verdict in every room. */
  const acidOnWall = ratio(ACID, wall);
  note("acid on the wall", acidOnWall, name);
  check(acidOnWall >= 7, `${name}: acid on the wall`, `${acidOnWall.toFixed(2)}`);
  const acidOnGlass = ratio(ACID, glass);
  check(acidOnGlass >= 7, `${name}: acid on glass`, `${acidOnGlass.toFixed(2)}`);

  /* The lifted control: the wall with a little cream in it, under cream. */
  const lifted = over(CREAM, 0.14, wall);
  const onLifted = ratio(CREAM, lifted);
  note("the lifted control", onLifted, name);
  check(onLifted >= 7, `${name}: cream on the lifted control`, `${onLifted.toFixed(2)}`);

  /* The cloud is not text, so it is held to the 3 to 1 asked of a graphic, and
     the heaviest laydown to a good deal more. A cloud that is not there is not
     a cloud. */
  const pale = ratio(hexToRgb(room.pale), wall);
  note("the cloud's thin pigment", pale, name);
  check(pale >= 3, `${name}: the cloud's thin pigment against the wall`, `${pale.toFixed(2)}`);
  const deep = ratio(hexToRgb(room.deep), wall);
  note("the cloud's heavy pigment", deep, name);
  check(deep >= 7, `${name}: the cloud's heavy pigment against the wall`, `${deep.toFixed(2)}`);

  /* A room that is black, or one that is light, is not one of these. */
  check(luminance(wall) > 0.004, `${name}: the wall is not black`, `${luminance(wall).toFixed(4)}`);
  check(luminance(wall) < 0.07, `${name}: the wall is dark`, `${luminance(wall).toFixed(4)}`);
}

/* The fixed colours: carbon on acid is the filled control and the swatch. */
const onAcid = ratio(CARBON, ACID);
check(onAcid >= 12, "carbon on acid", `${onAcid.toFixed(2)}`);

/* Paper. A sheet and a block of it turn the tokens over, and their quiet steps
   are carbon at an alpha over chalk. */
function paperBlock(selector: string): string {
  const at = css.indexOf(selector);
  if (at < 0) return "";
  return css.slice(at, css.indexOf("}", at));
}

const paperChecks: [string, string][] = [
  [".chalk-block {", ".chalk-block"],
  [".sheet,\n  .palette {", ".sheet"],
];
for (const [selector, label] of paperChecks) {
  const block = paperBlock(selector);
  check(block.length > 0, `the stylesheet has a ${label} block of tokens`);
  for (const step of ["--muted", "--faint"]) {
    const alpha = alphaOf(block, step);
    const value = ratio(over(CARBON, alpha, CHALK), CHALK);
    check(Number.isFinite(alpha) && value >= 4.5, `${label}: ${step} on paper`, `${value.toFixed(2)}`);
  }
}
check(ratio(CARBON, CHALK) >= 15, "carbon on paper", `${ratio(CARBON, CHALK).toFixed(2)}`);

/* One room for every shape the cloud takes, and one shape for every room, so a
   shape that comes back brings its room with it. */
const used = new Set<RoomName>();
for (const shape of SHAPE_NAMES) {
  const room = roomOfShape[shape];
  check(room !== undefined && room in rooms, `${shape} has a room`);
  if (room) used.add(room);
}
check(used.size === names.length, "every room is the room of a shape", `${used.size} of ${names.length}`);
check(roomOfShape.brain === homeRoom.name, "the brain is the first room");

/* The stylesheet, against the table. The first room is :root's and the rest
   have a block each that answers to the root's attribute and to a page's
   marker. */
check(
  property(rootBlock, "--wall")?.toLowerCase() === homeRoom.wall,
  "the stylesheet's wall is the first room's",
  `${property(rootBlock, "--wall")} against ${homeRoom.wall}`,
);
check(
  property(rootBlock, "--tone")?.toLowerCase() === homeRoom.tone,
  "the stylesheet's tone is the first room's",
  `${property(rootBlock, "--tone")} against ${homeRoom.tone}`,
);

for (const name of names) {
  if (name === homeRoom.name) continue;
  const selector = `html[data-room="${name}"],\nhtml:has([data-page-room="${name}"]) {`;
  const at = css.indexOf(selector);
  check(at >= 0, `the stylesheet has a block for ${name}, answering to the attribute and to a page's marker`);
  if (at < 0) continue;
  const block = css.slice(at, css.indexOf("}", at));
  const wall = property(block, "--wall")?.toLowerCase();
  const tone = property(block, "--tone")?.toLowerCase();
  check(wall === rooms[name].wall, `${name}: the stylesheet's wall is the table's`, `${wall} against ${rooms[name].wall}`);
  check(tone === rooms[name].tone, `${name}: the stylesheet's tone is the table's`, `${tone} against ${rooms[name].tone}`);
}

/* The fixed colours, in the stylesheet and in the module. */
for (const [token, expected] of [
  ["--carbon", carbon],
  ["--chalk", chalk],
  ["--cream", cream],
  ["--acid", acid],
] as const) {
  check(
    property(rootBlock, token)?.toLowerCase() === expected,
    `${token} is the same in the stylesheet and in the module`,
    `${property(rootBlock, token)} against ${expected}`,
  );
}

console.log(`Rooms: ${names.length} walls, ${names.join(", ")}`);
for (const [label, { value, room }] of Object.entries(worst)) {
  console.log(`  ${label.padEnd(26)} worst ${value.toFixed(2)} to 1 (${room})`);
}

if (failures > 0) {
  console.error(`\nRooms: ${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("Rooms: clean.");
