import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { ogImageUrl } from "@/lib/metadata";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";
import "./globals.css";

/* Only 400 and 500 are used. The single 600 on the site is `.longform strong`,
   which sits on Newsreader, so a semibold Plex Sans was being downloaded and
   never painted. */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/* Italic is declared explicitly. Without it the browser synthesises an oblique
   by slanting the upright, which is what the hero's emphasis and every <em> in
   the long-form were getting: wrong letterforms, and conspicuously so on a
   serif, where true italic is a different design rather than a tilt. */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Metadata merges per key, not per field: a page that declares openGraph
   replaces this whole object and loses the site-wide values, and declaring it
   at all suppresses any file-convention opengraph-image. Every page therefore
   builds its tags through buildMetadata() in @/lib/metadata, which always
   emits a complete openGraph including an explicit image. */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: `%s · ${siteTitle}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
    types: { "application/atom+xml": `${siteUrl}/feed.xml` },
  },
  openGraph: {
    type: "website",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    images: [{ url: ogImageUrl("/"), width: 1200, height: 630, alt: siteTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImageUrl("/")],
  },
};

/* Resolved per colour scheme, so the browser chrome matches the page it is
   framing rather than one of the two themes. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#101215" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First focusable element on the page. Visually hidden until it takes
            focus, so a keyboard user can reach the content without tabbing
            through the whole header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:border focus:border-accent focus:bg-panel focus:px-4 focus:py-2.5 focus:font-mono focus:text-xs focus:text-accent"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        {/* Static and deferred rather than a React component, so a page view
            is recorded as soon as the document is parsed instead of waiting
            for hydration. See the note at the top of the file. */}
        <script defer src="/analytics.js" />
      </body>
    </html>
  );
}
