import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { PaletteTrigger } from "@/components/palette-trigger";
import { contact, person } from "@/lib/site";

/* A triangle in the brand violet, which is the mark the design reference
   describes and the same shape the intro's particles and the ambient field are
   made of. Three uses of one form is the whole visual system. */
function Mark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="var(--action)"
      strokeWidth="1.4"
    >
      <polygon points="6,1.4 10.6,10 1.4,10" />
    </svg>
  );
}

/* Transparent, sitting directly on the canvas with no border and no fill. The
   rule that used to separate it from the page is gone: the reference is
   explicit that sections are divided by whitespace rather than by lines, and
   with a gradient behind it a header bar would read as a panel. */
export function SiteHeader() {
  return (
    <header className="gutter flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-[15px] font-normal tracking-[-0.01em] text-ink"
      >
        <Mark />
        {person.name}
      </Link>
      <div className="flex items-center gap-6">
        <nav aria-label="Main">
          <NavLinks />
        </nav>
        <PaletteTrigger />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="gutter mt-auto w-full pt-10 pb-14">
      <div className="border-t border-rule pt-8">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <a href={`mailto:${contact.email}`} className="text-[14px] text-accent hover:underline">
            {contact.email}
          </a>
          <a href={contact.linkedin} className="text-[14px] text-accent hover:underline">
            LinkedIn
          </a>
          <a href={contact.github} className="text-[14px] text-accent hover:underline">
            GitHub
          </a>
          <a href="/feed.xml" className="text-[14px] text-muted hover:text-accent">
            Feed
          </a>
          <Link href="/privacy" className="text-[14px] text-muted hover:text-accent">
            Privacy
          </Link>
        </div>
        <p className="measure mt-6 text-[14px] leading-relaxed text-muted">
          Nothing on this site is financial advice. Results labelled simulated or
          illustrative are model output over historical or user-supplied inputs,
          not a record of trading. © {new Date().getFullYear()} {person.name}.
        </p>
      </div>
    </footer>
  );
}
