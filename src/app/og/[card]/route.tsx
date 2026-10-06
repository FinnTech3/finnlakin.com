import { ImageResponse } from "next/og";
import { acid, carbon, wall } from "@/lib/colours";
import { shareCardByKey, shareCards } from "@/lib/share-cards";
import { person } from "@/lib/site";

/* Every card is prerendered at build and served as a static asset, so no
   request ever rasterises a PNG. dynamicParams refuses any key that is not on
   the list rather than falling through to a render. */
export function generateStaticParams() {
  return shareCards.map((card) => ({ card: card.key }));
}

export const dynamicParams = false;

/* Share cards have no viewer theme and no stylesheet, so the palette comes from
   src/lib/colours.ts rather than from tokens: the wall, the carbon on it, and a
   swatch of acid for the kicker, so a link preview looks like the page it
   opens.

   The type is the renderer's own. The site's headline face is a font file this
   renderer would have to be handed, and the file is not in this repository: a
   card set in a face that is nearly right is worse than one that is plainly a
   preview. Upper case and tight, which is as far as the default goes.

   The quiet colour is the carbon at four fifths over the wall, worked out to an
   opaque value because the renderer does not blend. It is about 5.4:1 on the
   wall. */
const MUTED = "#2f2f2d";

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
          background: wall,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          {kicker ? (
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: carbon,
                background: acid,
                padding: "6px 14px",
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 32,
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: title.length > 48 ? 68 : 88,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: -2,
              textTransform: "uppercase",
              color: carbon,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: "100%", height: 4, background: carbon }} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: carbon,
              }}
            >
              {person.name}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{person.course}</div>
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
