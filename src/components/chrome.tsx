import Link from "next/link";
import { BackToTop } from "@/components/back-to-top";
import { NavLinks } from "@/components/nav-links";
import { PaletteTrigger } from "@/components/palette-trigger";
import { contact, person } from "@/lib/site";

/* In the flow, above the page, and nothing else.

   The name is the one headline-face thing in it, with a small light beside it
   that takes the colour of whatever room the page is in and beats slowly, which
   is the only thing in the bar that moves. The navigation is a pill of its own
   with the current page filled in, and the search is a field.

   There is no rule under the bar and nothing in it is fixed to the window: it
   is above the cloud's lane and goes over nothing, and a bar pinned to the
   window would be over the cloud whichever side the lane was on. */
export function SiteHeader() {
  return (
    <header className="site-header shell flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3 py-6">
      <span aria-hidden="true" className="scroll-progress" />
      <Link
        href="/"
        className="t-h3 -ml-2 inline-flex items-center gap-2.5 rounded-full px-2 py-1 text-ink hover:bg-accent-soft hover:text-carbon"
      >
        <span aria-hidden="true" className="wordmark-dot" />
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
              <a href={`mailto:${contact.email}`} className="link-arrow t-label">
                {contact.email}
              </a>
              <a href={contact.linkedin} className="link-arrow t-label">
                LinkedIn
              </a>
              <a href={contact.github} className="link-arrow t-label">
                GitHub
              </a>
              <a href="/feed.xml" className="link-arrow t-label">
                Feed
              </a>
              <Link href="/privacy" className="link-arrow t-label">
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
