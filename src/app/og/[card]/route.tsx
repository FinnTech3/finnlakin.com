import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { acid, carbon, wall } from "@/lib/colours";
import { cream, hexToRgb, homeRoom, rgbToHex } from "@/lib/rooms";
import { shareCardByKey, shareCards } from "@/lib/share-cards";
import { person } from "@/lib/site";
import { brain } from "@/particles/brain-shape";
import { SEED } from "@/particles/targets";

/* Every card is prerendered at build and served as a static asset, so no
   request ever rasterises a PNG. dynamicParams refuses any key that is not on
   the list rather than falling through to a render. */
export function generateStaticParams() {
  return shareCards.map((card) => ({ card: card.key }));
}

export const dynamicParams = false;

/* The card is the opening: the name in the page's own face, in cream, on the
   first room's wall, with the brain beside it. That is the first thing the site
   does and the thing a link should look like.

   The card renderer has no stylesheet and cannot reach the page's fonts, so the
   face is handed to it as a file. Bricolage Grotesque at the headline weight,
   cut from the variable font the site sets its headings in as a single static
   instance (weight 700, width 100, the largest optical size), because the
   renderer takes a file per weight and not an axis. Vendored in ./fonts with its
   licence (SIL OFL 1.1, which allows exactly this). Read at build, because every
   card is prerendered. The palette is src/lib/colours.ts and src/lib/rooms.ts,
   since there are no tokens here.

   The brain is the engine's own, not a picture of it: the same generator and
   the same seed the page builds its cloud from, projected flat and drawn as
   dots in the room's own pigments. It is deterministic, so the card is the same
   every build.

   Every page's card carries the name. A page that is not the home page says
   which page, in the acid kicker and a line under the rule, so a shared essay is
   still an essay and still plainly his. */
const SIZE = { width: 1200, height: 630 };

/* Cream at seven tenths over the wall, as an opaque value because the renderer
   does not blend. About 9:1 on the wall. */
const mix = (from: string, over: string, share: number) => {
  const a = hexToRgb(from);
  const b = hexToRgb(over);
  return rgbToHex([0, 1, 2].map((i) => a[i]! * share + b[i]! * (1 - share)) as [number, number, number]);
};
const MUTED = mix(cream, wall, 0.7);

/* The cloud, flat. Seen from the side as the page shows it, fitted to a box
   beside the name. Drawn from the engine's generator at a count a card can
   carry: enough dots to read as the same brain, few enough that the file is a
   normal size. */
const CLOUD = { count: 5200, width: 430, height: 330 };

function cloud() {
  const { shape, tone } = brain(CLOUD.count, SEED);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < CLOUD.count; i++) {
    const x = shape[i * 3]!;
    const y = shape[i * 3 + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const fit = Math.min(CLOUD.width / (maxX - minX), CLOUD.height / (maxY - minY));
  const offsetX = (CLOUD.width - (maxX - minX) * fit) / 2;
  const offsetY = (CLOUD.height - (maxY - minY) * fit) / 2;

  return Array.from({ length: CLOUD.count }, (_, i) => {
    const depth = shape[i * 3 + 2]!;
    const bright = tone[i]!;
    return {
      cx: offsetX + (shape[i * 3]! - minX) * fit,
      cy: offsetY + (maxY - shape[i * 3 + 1]!) * fit,
      r: 0.8 + 1.1 * Math.min(1, Math.max(0, depth * 1.6)),
      fill: mix(homeRoom.deep, homeRoom.pale, Math.min(1, Math.max(0, bright))),
    };
  });
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/[card]">,
) {
  const { card: key } = await params;
  const card = shareCardByKey.get(key);
  const font = await readFile(join(process.cwd(), "src/app/og/fonts/BricolageGrotesque-Bold.ttf"));

  /* dynamicParams = false means an unknown key never reaches here, so this is
     a type narrowing rather than a runtime path. */
  const isHome = key === "home" || !card;
  const title = clamp(card?.title ?? person.name, 44);
  const kicker = card?.kicker ? clamp(card.kicker, 40) : null;
  const dots = cloud();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          background: wall,
          padding: "52px 72px 48px",
          fontFamily: "Bricolage Grotesque",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 40,
            top: 48,
            width: CLOUD.width,
            height: CLOUD.height,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={CLOUD.width}
            height={CLOUD.height}
            viewBox={`0 0 ${CLOUD.width} ${CLOUD.height}`}
          >
            {dots.map((dot, index) => (
              <circle key={index} cx={dot.cx.toFixed(1)} cy={dot.cy.toFixed(1)} r={dot.r.toFixed(2)} fill={dot.fill} />
            ))}
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 236,
            fontWeight: 700,
            lineHeight: 0.86,
            letterSpacing: -7,
            textTransform: "uppercase",
            color: cream,
          }}
        >
          {person.name.split(" ").map((word) => (
            <div key={word} style={{ display: "flex" }}>
              {word}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 3, background: cream }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              {kicker ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 700,
                    color: carbon,
                    background: acid,
                    padding: "4px 20px",
                    borderRadius: 999,
                    marginRight: 22,
                  }}
                >
                  {kicker}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontSize: 34,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  color: cream,
                  whiteSpace: "nowrap",
                }}
              >
                {isHome ? person.course : title}
              </div>
            </div>
            {isHome ? (
              <div
                style={{
                  display: "flex",
                  flexShrink: 0,
                  marginLeft: 24,
                  fontSize: 28,
                  fontWeight: 700,
                  color: MUTED,
                }}
              >
                finnlakin.co.uk
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [{ name: "Bricolage Grotesque", data: font, weight: 700, style: "normal" }],
    },
  );
}
