import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: siteTitle }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/api/og"],
  },
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
