import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { PaletteTrigger } from "@/components/palette-trigger";
import { contact, person } from "@/lib/site";

/* The same triangle, in whatever ink the bar is sitting on. It used to be
   stroked in the old brand violet, which is not a colour this system has: the
   brief's logo mark is the one dark value and nothing else. Taking
   currentColor also means it comes out white over the stage and ink on paper
   without the header having to say so twice. */
function Mark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <polygon points="6,1.4 10.6,10 1.4,10" />
    </svg>
  );
}

/* Transparent, no border, no shadow, no separator: the brief calls its own
   navigation whisper-quiet and this is that.

   Laid over the top of the page rather than stacked above it. The home page
   opens on the dark stage, and a header in the flow would have put a white
   strip above it. It is not sticky, so it scrolls away with the stage and
   never has to change colour halfway down a page; site-header in the
   stylesheet gives it the stage's ink on any page that has one. */
export function SiteHeader() {
  return (
    <header className="site-header shell flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
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
    <footer className="site-footer mt-auto w-full bg-paper">
      <div className="shell pt-10 pb-14">
      <div className="border-t border-rule pt-8">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <a href={`mailto:${contact.email}`} className="link-arrow text-[15px]">
            {contact.email}
          </a>
          <a href={contact.linkedin} className="link-arrow text-[15px]">
            LinkedIn
          </a>
          <a href={contact.github} className="link-arrow text-[15px]">
            GitHub
          </a>
          <a href="/feed.xml" className="text-[15px] text-muted hover:text-ink">
            Feed
          </a>
          <Link href="/privacy" className="text-[15px] text-muted hover:text-ink">
            Privacy
          </Link>
        </div>
        <p className="measure mt-6 text-[15px] leading-relaxed text-muted">
          Nothing on this site is financial advice. Results labelled simulated or
          illustrative are model output over historical or user-supplied inputs,
          not a record of trading. © {new Date().getFullYear()} {person.name}.
        </p>
        </div>
      </div>
    </footer>
  );
}
