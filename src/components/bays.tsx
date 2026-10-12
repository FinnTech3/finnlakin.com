import { bays } from "@/lib/bays";
import { numberWord } from "@/lib/numbers";

/* The other half of the work, held open and saying so.

   Finn has art and clothes that belong on this site. A bay is cut into the wall
   and empty until he puts something of his in it, and a placeholder that was
   somebody else's picture would be the one thing this site argues against.

   The list is src/lib/bays.ts. A bay with a piece shows it, the heading counts
   the filled ones from the data and not from a sentence somebody has to
   remember to edit, and the paragraph says which of the two it is. */
export function Bays() {
  const filled = bays.filter((bay) => bay.piece).length;
  const status =
    filled === 0 ? "none filled" : filled === bays.length ? "all filled" : `${numberWord(filled)} filled`;

  return (
    <div className="scored mt-16 pt-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
        <h3 className="t-hsm">Bays</h3>
        <span className="t-label">
          {numberWord(bays.length, { capital: true })} cut, {status}
        </span>
      </div>
      <p className="measure t-body-lg mb-8 text-ink-soft">
        {filled === 0
          ? "Space held for the other half of the work: the pictures, the prints, the clothes. Empty until there is something of mine to put in it, because a wall hung with stock images is an advertisement for stock images."
          : "The other half of the work: the pictures, the prints, the clothes. What is filled is mine, and the rest is held open until there is something of mine to put in it."}
      </p>
      <div className="grid grid-cols-2 gap-4 @xl:grid-cols-3 @3xl:grid-cols-5">
        {bays.map((bay, index) =>
          bay.piece ? (
            <figure key={bay.label} className="m-0">
              <div className="relative aspect-square overflow-hidden border-2 border-[var(--rule-strong)]">
                {/* A plain image. next/image would put its client runtime on the
                    home page whether or not a bay is filled, and the home page's
                    JavaScript has a ceiling. The size is stated, so nothing
                    moves when it loads. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bay.piece.src}
                  alt={bay.piece.alt}
                  width={bay.piece.width}
                  height={bay.piece.height}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="t-label mt-2">
                {String(index + 1).padStart(2, "0")} {bay.label}
                {bay.piece.caption ? `: ${bay.piece.caption}` : ""}
              </figcaption>
            </figure>
          ) : (
            <div key={bay.label} className="bay">
              <span className="bay-no">{String(index + 1).padStart(2, "0")}</span>
              <span className="t-label">{bay.label}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
