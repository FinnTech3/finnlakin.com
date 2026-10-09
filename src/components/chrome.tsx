import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { NavLinks } from "@/components/nav-links";
import { PaletteTrigger } from "@/components/palette-trigger";
import { contact, person } from "@/lib/site";

/* In the flow, above the page, and nothing else.

   It used to be laid over the top of the page, because the home page opened on
   a full height black stage and a header in the flow would have put a strip of
   something else above it. There is no stage. The wall runs from the top of the
   window to the bottom, so the header is an ordinary block and every page
   starts below it without keeping room for it.

   The name is the one headline-face thing in it. The navigation is labels, in
   the terminal's voice, and the search is a ruled box. There is no rule under
   the bar: a line across the full width would run through the lane the cloud
   travels down, and the cloud goes over nothing. */
export function SiteHeader() {
  return (
    <header className="site-header shell flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
      <Link href="/" className="t-h3 text-ink hover:bg-accent-soft">
        {person.name}
      </Link>

      {/* Centred in the space between the name and the search on a screen wide
          enough for three columns. Below that the links sit on a row of their
          own, under the name. */}
      <nav
        aria-label="Main"
        className="order-last w-full sm:order-none sm:flex sm:w-auto sm:flex-1 sm:justify-center"
      >
        <NavLinks />
      </nav>

      <PaletteTrigger />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer mt-auto w-full">
      <div className="shell pt-10 pb-14">
        <div className="scored pt-6">
          {/* The links, and at the end of the row the way back to the top. It
              wraps below them on a screen with no room beside them. */}
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <a href={`mailto:${contact.email}`} className="link-arrow t-label text-ink">
                {contact.email}
              </a>
              <a href={contact.linkedin} className="link-arrow t-label text-ink">
                LinkedIn
              </a>
              <a href={contact.github} className="link-arrow t-label text-ink">
                GitHub
              </a>
              <a href="/feed.xml" className="link-arrow t-label text-ink">
                Feed
              </a>
              <Link href="/privacy" className="link-arrow t-label text-ink">
                Privacy
              </Link>
            </div>
            <BackToTop />
          </div>
          <p className="measure t-caption mt-6 text-muted">
            Nothing on this site is financial advice. Results labelled simulated or
            illustrative are model output over historical or user-supplied inputs,
            not a record of trading. © {new Date().getFullYear()} {person.name}.
          </p>
        </div>
      </div>
    </footer>
  );
}
