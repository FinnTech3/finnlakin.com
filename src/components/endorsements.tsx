import { endorsements } from "@/lib/endorsements";

/* Somebody else speaking, and the page should look like it changed voice.

   The first version of this gave each quote a surface of its own, a tinted card
   with a drawn quotation mark and a disc of initials. The wall has no cards, no
   radius and no ornament, so what is left is what a quotation actually needs:
   the words, set in the headline face so they are plainly not the page's own
   voice, and a label saying whose they are.

   A person is named in the label and not in a disc, because a disc of initials
   was a stand-in for a photograph that is not here, and the name is the honest
   version of the same affordance. */
export function Endorsements() {
  return (
    <div className="grid gap-12 @3xl:grid-cols-2">
      {endorsements.map((endorsement) => (
        <figure key={endorsement.id} className="scored m-0 flex flex-col gap-6 pt-5">
          <blockquote className="quote text-pretty">{endorsement.quote}</blockquote>

          <figcaption className="mt-auto flex flex-col gap-1">
            <span className="t-label text-ink">{endorsement.name}</span>
            <span className="t-label">{endorsement.role}</span>
          </figcaption>

          {endorsement.trimmed ? (
            <p className="t-caption leading-relaxed text-muted">
              <span className="t-label">Cut. </span>
              {endorsement.trimNote}
            </p>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
