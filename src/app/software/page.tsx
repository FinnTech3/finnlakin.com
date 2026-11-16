import { RoomMarker } from "@/components/room-marker";
import { Section } from "@/components/section";
import { SoftwareCard } from "@/components/software-card";
import { buildMetadata } from "@/lib/metadata";
import { numberWord } from "@/lib/numbers";
import { pageRoom, roomViewport } from "@/lib/page-rooms";
import { products } from "@/lib/software";

const skills = products.filter((product) => product.kind === "skill");
const waiting = skills.filter((product) => !product.agensi);

export const metadata = buildMetadata({
  path: "/software",
  title: "Software",
  description: `${numberWord(products.length, { capital: true })} tools I have built and am now selling: agent skills and a desktop app, each with a real demo, one number I can back and a plain statement of what it will not do.`,
});

export const viewport = roomViewport(pageRoom.software);

/* What I am working on now, and the work that backs it. Every card is rendered
   from lib/software.ts, so a product is added there and appears here, in the
   search and in the home page's teaser at once.

   The marketplace is said once, above the list, and only as far as it is true:
   a skill is sold on Agensi, and until its listing is live the card links to the
   source instead. */
export default function SoftwarePage() {
  const checked = products.filter((product) => product.tests !== null);

  return (
    <>
      <RoomMarker room={pageRoom.software} />
      <Section
        id="software"
        level={1}
        eyebrow="Software"
        title="What I build, and now sell"
        intro={`I build software and I am now selling it. ${numberWord(products.length, { capital: true })} tools so far, each with a demo that is a real run, one number I can back and a plain statement of what it will not do.`}
      >
        <p className="measure t-caption leading-relaxed text-muted">
          {waiting.length === 0
            ? "The skills are sold on Agensi, a marketplace for agent skills."
            : waiting.length === skills.length
              ? "The skills are sold on Agensi, a marketplace for agent skills. None of the listings is live yet, so each card links to the source on GitHub until it is."
              : waiting.length === 1
                ? `The skills are sold on Agensi, a marketplace for agent skills. One of the ${numberWord(skills.length)} has no listing yet, and its card links to the source on GitHub until it has.`
                : `The skills are sold on Agensi, a marketplace for agent skills. ${numberWord(waiting.length, { capital: true })} of the ${numberWord(skills.length)} have no listing yet, and those cards link to the source on GitHub until they have.`}
        </p>

        <div className="mt-12 flex flex-col">
          {products.map((product, index) => (
            <SoftwareCard key={product.slug} product={product} index={index} />
          ))}
        </div>

        <section aria-labelledby="checks" className="scored pt-8">
          <div data-reveal="">
            <h2 id="checks" className="t-hsm max-w-[12em] text-ink text-balance">
              How I check my own work
            </h2>
            <p className="measure t-body-lg mt-5 text-ink-soft">
              The scripts behind the skills are tested offline and the counts below are from running
              each suite. Each skill also passes the packaging checker in its own repository, with 0
              failed and 0 warnings. That is a check I run myself, not a verdict from Agensi.
            </p>
          </div>

          <dl data-reveal="" className="glass mt-8 grid max-w-[44rem] gap-x-10 gap-y-4 p-6 @3xl:grid-cols-2">
            {checked.map((product) => (
              <div key={product.slug} className="flex items-baseline justify-between gap-6">
                <dt className="text-[0.9375rem] text-ink-soft">{product.name}</dt>
                <dd className="tnum text-ink">{product.tests} tests</dd>
              </div>
            ))}
          </dl>

          <p data-reveal="" className="measure t-caption mt-8 leading-relaxed text-muted">
            <span className="font-bold text-ink">Not done yet.{" "}</span>
            None of the skills has been run in a live agent against its trigger prompts. The prompts
            are written down in each repository, in <code>agensi/TRIGGER_TESTS.md</code>, and each is
            ticked off when it has been run. Quiet Snow is built and run in CI on both systems, which
            is all I can claim for it.
          </p>
        </section>
      </Section>
    </>
  );
}
