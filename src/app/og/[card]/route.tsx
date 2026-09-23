import { ImageResponse } from "next/og";
import { shareCardByKey, shareCards } from "@/lib/share-cards";
import { person } from "@/lib/site";

/* Every card is prerendered at build and served as a static asset, so no
   request ever rasterises a PNG. dynamicParams refuses any key that is not on
   the list rather than falling through to a render. */
export function generateStaticParams() {
  return shareCards.map((card) => ({ card: card.key }));
}

export const dynamicParams = false;

/* Share cards have no viewer theme and no stylesheet, so the palette is
   hard-coded here rather than read from tokens. The values are DESIGN.md's,
   so a link preview looks like the page it opens.

   Paper rather than the stage's black. The stage is the first thing a reader
   sees in a browser, but it is one band of one route, and everything a shared
   link actually lands on is paper. A preview card in the old palette was a
   black rectangle with an amber kicker, which by the end of this rebuild
   matched nothing on the site at all.

   The kicker takes the sienna that goes with the peach, which is the one place
   colour is allowed. */
const PAPER = "#ffffff";
const INK = "#17191c";
const MUTED = "#5f636c";
const RULE = "#ececec";
const ACCENT = "#5d2a1a";

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

  /* dynamicParams = false means an unknown key never reaches here, so this is
     a type narrowing rather than a runtime path. */
  const title = clamp(card?.title ?? person.name, 90);
  const kicker = card?.kicker ? clamp(card.kicker, 60) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {kicker ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: ACCENT,
                marginBottom: 28,
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: title.length > 48 ? 68 : 84,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: INK,
              maxWidth: 960,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 1, background: RULE }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <div style={{ display: "flex", fontSize: 28, color: INK }}>{person.name}</div>
            <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
              {person.course}
            </div>
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
