import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Backdrop, Scrim } from "@/components/backdrop";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Intro, IntroBoot } from "@/components/intro";
import { ParticleBrain } from "@/components/particle-brain";
import { ogImageUrl } from "@/lib/metadata";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";
import "./globals.css";

/* One family, where there used to be three. The design reference is explicit
   that a single typeface carries every context and that hierarchy comes from
   scale rather than weight, and Inter is the substitute it names.

   No weight array, which gets the variable font: one file covering 100 to 900
   instead of a static face per weight. This site uses five of them (200 body,
   300 long-form, 400 display and figures, 500 emphasis, 600 labels), so as
   static faces that would have been five downloads. */
const inter = Inter({
  variable: "--font-inter",
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

/* One colour now, because there is one theme. The pair that used to be here
   resolved per colour scheme so the browser chrome matched whichever of the
   two themes was showing; the site is black in both. */
export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* First thing in the document, so the decision about the opening
            animation is made before anything paints. It sets one attribute.
            See the note in components/intro.tsx. */}
        <IntroBoot />

        {/* Behind everything, in this order: the shader, the scrim that holds
            it down, then the particle cloud above both. The cloud is above the
            scrim on purpose, so its colours are not capped, and carries its own
            dimming wherever text is laid over it. All three are decoration and
            none can be reached by a pointer or a screen reader. */}
        <Backdrop />
        <Scrim />
        {/* Above the scrim, so its colours run at full strength, and below
            everything that carries words. It mounts itself only on the home
            page, whose sections the timeline is choreographed against. */}
        <ParticleBrain />

        {/* First focusable element on the page. Visually hidden until it takes
            focus, so a keyboard user can reach the content without tabbing
            through the whole header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-70 focus:border focus:border-action focus:bg-black focus:px-4 focus:py-2.5 focus:t-label focus:text-ink"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        <Intro />
        {/* Static and deferred rather than a React component, so a page view
            is recorded as soon as the document is parsed instead of waiting
            for hydration. See the note at the top of the file. */}
        <script defer src="/analytics.js" />
      </body>
    </html>
  );
}
