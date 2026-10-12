import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { acid, carbon, chalk as CHALK } from "@/lib/colours";
import { shareCardByKey, shareCards } from "@/lib/share-cards";
import { person } from "@/lib/site";

/* Every card is prerendered at build and served as a static asset, so no
   request ever rasterises a PNG. dynamicParams refuses any key that is not on
   the list rather than falling through to a render. */
export function generateStaticParams() {
  return shareCards.map((card) => ({ card: card.key }));
}

export const dynamicParams = false;

/* The card is the opening: the name in the headline face, in chalk, on the
   carbon the opening plays over. That is the first thing the site does and the
   thing a link should look like.

   The card renderer has no stylesheet and cannot reach the page's fonts, so the
   face is handed to it as a file. Big Shoulders Bold, from the same family the
   site sets its headlines in, vendored in ./fonts with its licence (SIL OFL
   1.1, which allows exactly this). Read at build, because every card is
   prerendered. The palette is src/lib/colours.ts, since there are no tokens
   here.

   Every page's card carries the name. A page that is not the home page says
   which page, in the acid kicker and a line under the rule, so a shared essay is
   still an essay and still plainly his. */
/* Chalk at seven tenths over the carbon, as an opaque value because the
   renderer does not blend. About 9:1 on the carbon. */
const MUTED = "#b6b4b0";

const SIZE = { width: 1200, height: 630 };

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/og/[card]">,
) {
  const { card: key } = await params;
  const card = shareCardByKey.get(key);
  const font = await readFile(join(process.cwd(), "src/app/og/fonts/BigShoulders-Bold.ttf"));

  /* dynamicParams = false means an unknown key never reaches here, so this is
     a type narrowing rather than a runtime path. */
  const isHome = key === "home" || !card;
  const title = clamp(card?.title ?? person.name, 44);
  const kicker = card?.kicker ? clamp(card.kicker, 40) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: carbon,
          padding: "44px 72px 48px",
          fontFamily: "Big Shoulders",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 272,
            fontWeight: 700,
            lineHeight: 0.82,
            letterSpacing: -3,
            textTransform: "uppercase",
            color: CHALK,
          }}
        >
          {person.name.split(" ").map((word) => (
            <div key={word} style={{ display: "flex" }}>
              {word}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 4, background: CHALK }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
              {kicker ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: 30,
                    color: carbon,
                    background: acid,
                    padding: "2px 14px",
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    marginRight: 22,
                  }}
                >
                  {kicker}
                </div>
              ) : null}
              <div
                style={{
                  display: "flex",
                  fontSize: 36,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: CHALK,
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
                  letterSpacing: 2,
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
      fonts: [{ name: "Big Shoulders", data: font, weight: 700, style: "normal" }],
    },
  );
}
