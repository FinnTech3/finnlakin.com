import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Martian_Mono } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Intro, IntroBoot } from "@/components/intro";
import { ParticleBrainMount } from "@/components/particle-brain-mount";
import { wall } from "@/lib/colours";
import { ogImageUrl } from "@/lib/metadata";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";
import "./globals.css";

/* Two families, each at one end of the scale and nowhere between.

   Big Shoulders is the headline face: condensed, upper case, and on the home
   page enormous enough to be cropped by the edge of the screen. Martian Mono is
   everything that is read: wide, small and spaced, the way a terminal prints a
   listing. A third face would be a step in the middle of a scale whose whole
   point is that it has none.

   No weight array on either, which gets the variable font: one file covering
   the whole axis rather than a static face per weight. The mono also loads its
   width axis, because the labels are set wider than the body.

   The stand-ins for the faces while they arrive are made by hand in
   globals.css, from measurements of the real faces, because the ones next/font
   makes are wrong for this pair. For Big Shoulders it cannot make one (the
   build says so and carries on), and the one it makes for Martian Mono is
   Arial scaled, which is the wrong width for the labels on any machine that has
   Arial. There is no option here to turn them off: adjustFontFallback is
   passed on and this version of the bundler makes them anyway, which is
   checked in the built stylesheet and asserted in the tests. The hand made one
   takes the generated one's place by name instead. */
const shoulders = Big_Shoulders({
  variable: "--font-shoulders",
  subsets: ["latin"],
  display: "swap",
});

const martian = Martian_Mono({
  variable: "--font-martian",
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
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
    images: [
      { url: ogImageUrl("/"), width: 1200, height: 630, alt: siteTitle },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [ogImageUrl("/")],
  },
};

/* The wall, because every page is the wall and the browser's own chrome should
   meet it rather than flash a different grey above it. */
export const viewport: Viewport = {
  themeColor: wall,
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${shoulders.variable} ${martian.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* First thing in the document, so the decision about the opening
            animation is made before anything paints. It sets one attribute.
            See the note in components/intro.tsx. */}
        <IntroBoot />

        {/* The cloud has no layer of its own to sit on. The wall is painted on
            the root element, the canvas is fixed behind everything at a
            negative z-index, and every block in the page is transparent, so
            the cloud shows through to the wall and never over a word. That is
            a rule about the whole page: nothing between the root and the
            content may paint an opaque background, or the cloud is covered.

            It is kept off the words by the final pass cutting it to the space
            the layout leaves for it, not by being dimmed. It mounts itself only
            on the home page. */}
        <ParticleBrainMount />

        {/* First focusable element on the page. Visually hidden until it takes
            focus, so a keyboard user can reach the content without tabbing
            through the whole header on every navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-70 focus:border-2 focus:border-carbon focus:bg-chalk focus:px-4 focus:py-2.5 focus:t-label focus:text-carbon"
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
