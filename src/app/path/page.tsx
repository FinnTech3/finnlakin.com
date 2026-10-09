import { Section } from "@/components/section";
import { Timeline } from "@/components/timeline";
import { buildMetadata } from "@/lib/metadata";
import { person } from "@/lib/site";
import { timeline } from "@/lib/timeline";

export const metadata = buildMetadata({
  path: "/path",
  title: "Path",
  description: `Where ${person.name} has studied and worked: ${person.course} at ${person.university}, an exchange year at ${person.exchange}, and the work either side of it.`,
});

/* The narrative version of the same entries the CV renders.

   Two pages off one typed module, and they are not a duplication: they answer
   different questions. /cv is a document, tight enough to print and to send,
   and a recruiter reads it in ninety seconds. This one has room for the part
   that does not belong on a CV, which is what each place was actually like and
   what it taught: the asides in timeline.ts exist for this page and are dropped
   from the CV.

   It has no lane. The particle cloud is on the home page only, and a band that
   leaves a third of the screen empty with nothing travelling down it is not a
   composition, it is a margin. */
export default function PathPage() {
  const years = timeline.length;

  return (
    <Section
      id="path"
      eyebrow="Path"
      title="Where I have studied and worked"
      level={1}
      intro={`${years} entries, most recent first. The CV is the same history at a tenth of the length, if that is what you are here for.`}
    >
      <Timeline level={2} />
    </Section>
  );
}
