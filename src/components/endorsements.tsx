import { endorsements } from "@/lib/endorsements";

/* Two tints, alternating, and they are the first colour on the paper half of
   the site that is not a verdict.

   The brief rations colour to functional emphasis and the rest of this design
   obeys that: the peach callout marks what a project does not show, green and
   red mark whether a reconstruction held, and nothing else is coloured at all.
   These were black on white with a hairline rule under each, which is what that
   rule produces when it is applied to a quotation, and what it produced was two
   paragraphs nobody's eye stopped on.

   A testimonial is somebody else speaking, and the page should look like it
   changed voice. So each gets a surface of its own: the system's own peach with
   its sienna ink, and an icy blue drawn from the particle cloud's own pigments,
   which is the one other colour this site already owns.

   Measured on the surfaces they actually land on rather than picked: the quotes
   run at 9.27:1 and 10.12:1, the attributions at 6.70 and 6.68, against a floor
   of 4.5. The last grey chosen by eye here came out at 4.495, which rounds to
   the bar in a report and fails it in the arithmetic. */
const TINTS = ["quote-peach", "quote-ice"] as const;

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function Endorsements() {
  return (
    <div className="grid gap-8 @3xl:grid-cols-2">
      {endorsements.map((endorsement, index) => (
        <figure
          key={endorsement.id}
          className={`quote-card ${TINTS[index % TINTS.length]} flex flex-col gap-6`}
        >
          {/* Decoration, so it is not in the reading order: a screen reader
              announcing an opening quotation mark before every quotation is
              noise, and blockquote already says what this is. */}
          <span aria-hidden="true" className="quote-mark">
            &ldquo;
          </span>

          <blockquote className="quote-body text-pretty">{endorsement.quote}</blockquote>

          <figcaption className="mt-auto flex items-center gap-4 pt-2">
            <span aria-hidden="true" className="quote-disc">
              {initials(endorsement.name)}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="quote-name text-[16px]">{endorsement.name}</span>
              <span className="quote-role text-[14px]">{endorsement.role}</span>
            </span>
          </figcaption>

          {endorsement.trimmed ? (
            <p className="quote-note text-[13px] leading-relaxed">
              <span className="t-label quote-role">Cut. </span>
              {endorsement.trimNote}
            </p>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
