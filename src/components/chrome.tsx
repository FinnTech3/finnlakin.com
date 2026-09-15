import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { PaletteTrigger } from "@/components/palette-trigger";
import { contact, person } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 sm:px-8">
        <Link href="/" className="font-serif text-lg tracking-[-0.01em]">
          {person.name}
        </Link>
        <div className="flex items-center gap-5">
          <nav aria-label="Main">
            <NavLinks />
          </nav>
          <PaletteTrigger />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10 sm:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={`mailto:${contact.email}`}
            className="font-mono text-[12px] text-accent hover:underline"
          >
            {contact.email}
          </a>
          <a
            href={contact.linkedin}
            className="font-mono text-[12px] text-accent hover:underline"
          >
            LinkedIn
          </a>
          <a
            href={contact.github}
            className="font-mono text-[12px] text-accent hover:underline"
          >
            GitHub
          </a>
          <a
            href="/feed.xml"
            className="font-mono text-[12px] text-muted hover:text-accent"
          >
            Feed
          </a>
          <Link
            href="/privacy"
            className="font-mono text-[12px] text-muted hover:text-accent"
          >
            Privacy
          </Link>
        </div>
        <p className="max-w-[68ch] text-xs leading-relaxed text-muted">
          Nothing on this site is financial advice. Results labelled simulated or
          illustrative are model output over historical or user-supplied inputs,
          not a record of trading. © {new Date().getFullYear()} {person.name}.
        </p>
      </div>
    </footer>
  );
}
