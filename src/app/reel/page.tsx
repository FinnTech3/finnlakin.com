import { ClipPlayer } from "@/components/clip";
import { buildMetadata } from "@/lib/metadata";
import { clips } from "@/lib/media";

export const metadata = buildMetadata({
  path: "/reel",
  title: "Reel",
  description:
    "A full-bleed scroller: one clip a screen, each with what it is doing here. Scaffolding for the video work to come.",
});

/* The reel: one clip a screen, edge to edge.

   Built ahead of the idea it is for. What it proves today is the part that is
   actually uncertain: whether this site can carry video at all without the page
   stuttering, the layout shifting, or the bytes arriving for a reader who never
   scrolls this far. Those answers do not change when the content does. Every clip is lazy, paused off screen, silent, and stands behind a
   poster frame from its own first second.

   No lane here and no particle cloud: the engine is mounted on the home page
   only. A full-bleed clip is the whole width by definition, so there is nothing
   for a lane to be beside. */
export default function ReelPage() {
  return (
    <div className="flex w-full flex-col">
      <header className="band-inner py-16 sm:py-24">
        <p className="t-label">Reel</p>
        <h1 className="t-h mt-4 max-w-[18ch] text-ink text-balance">
          Things that are easier to show than to say
        </h1>
        <p className="measure-tight t-body-lg mt-6 text-muted">
          One clip a screen. None of this is my own footage yet, and every frame
          says where it came from, which is the same rule the numbers on this
          site follow.
        </p>
      </header>

      {clips.map((clip, index) => (
        <section key={clip.id} className="relative w-full">
          <figure className="relative m-0 h-[70svh] w-full overflow-hidden sm:h-[88svh]">
            <ClipPlayer clip={clip} />

            {/* The scrim is not decoration. A caption in white over a bright
                frame of a clip is a caption whose contrast changes every frame,
                and the only honest way to hold it is to put a known surface
                between the two. */}
            <div aria-hidden="true" className="clip-scrim" />

            <figcaption className="band-inner absolute inset-x-0 bottom-0 pb-10 sm:pb-14">
              <p className="t-label">
                {String(index + 1).padStart(2, "0")}
              </p>
              <p className="measure mt-3 text-[19px] leading-snug text-ink text-pretty sm:text-[22px]">
                {clip.caption}
              </p>
              <p className="mt-4 text-[13px] text-muted">
                {clip.credit} ·{" "}
                <a href={clip.href} className="link-arrow">
                  source
                </a>
              </p>
            </figcaption>
          </figure>
        </section>
      ))}

      <div className="band-inner py-16 sm:py-20">
        <p className="measure text-[15px] leading-relaxed text-muted">
          Licences and the reason each clip was chosen are recorded in
          <code className="mx-1.5 text-ink">public/media/SOURCE.md</code>,
          including the two that were rejected: one was a wall of third-party
          logos and the other had a company sign on the building.
        </p>
      </div>
    </div>
  );
}
