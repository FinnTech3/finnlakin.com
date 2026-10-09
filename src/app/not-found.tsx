import Link from "next/link";
import { Section } from "@/components/section";

/* A bad address.

   There was no page for this, so a mistyped link showed the framework's own,
   which is a white box with black type in the middle of a grey wall. This is the
   same wall and the same voice as everything else: the work is an index, so an
   address that is not in it is not on the index. */
export default function NotFound() {
  return (
    <Section
      id="not-found"
      level={1}
      eyebrow="404"
      title="Not on the index"
      intro="There is nothing at this address. It may have moved, or it may never have been here."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="pill pill-filled min-h-11">
          Back to the work
        </Link>
        <Link href="/writing" className="pill pill-ghost min-h-11">
          Long-form
        </Link>
      </div>
    </Section>
  );
}
