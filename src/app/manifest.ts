import type { MetadataRoute } from "next";
import { person, siteDescription } from "@/lib/site";

/* display is "browser" deliberately. This is a site, not an application, and
   there is no service worker behind it, so claiming standalone display would
   promise an installed experience that does not exist. The manifest is here
   for the icon set and the theme colour, which is all it is being asked to
   do. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: person.name,
    short_name: person.name,
    description: siteDescription,
    start_url: "/",
    display: "browser",
    background_color: "#f7f7f4",
    theme_color: "#f7f7f4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
