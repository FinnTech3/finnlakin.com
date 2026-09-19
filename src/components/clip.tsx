"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/media";

/* A clip, played only when it is on screen and only if the reader has not asked
   for less motion.

   Muted and loop are what make autoplay legal in a browser at all; the rest is
   courtesy. An IntersectionObserver keeps every clip that is not in view
   paused, because four videos decoding at once on a laptop is a fan spinning up
   for something nobody is watching, and preload="none" means a reader who never
   scrolls that far never pays for the bytes.

   The poster is a real frame from the clip rather than a colour, so the layout
   is complete before any video arrives and there is no flash of nothing.

   No controls and no audio, because these are not media to be operated. They
   are the visual equivalent of a pull quote, and a play button on one invites a
   reader to look for a soundtrack that is not there. */
export function ClipPlayer({ clip, className }: { clip: Clip; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video || !motion) return;
    if (typeof IntersectionObserver === "undefined") return;

    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          /* A rejected play() is not an error worth surfacing: a browser that
             refuses autoplay leaves the poster, which is a still from the clip
             and says the same thing more quietly. */
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 },
    );
    watcher.observe(video);
    return () => watcher.disconnect();
  }, [motion]);

  return (
    <video
      ref={ref}
      className={className ?? "block h-full w-full object-cover"}
      poster={clip.poster}
      src={motion ? clip.src : undefined}
      preload="none"
      muted
      loop
      playsInline
      /* Decoration with a description: the caption beside it carries the point,
         and this carries what is in the frame for a reader who cannot see it. */
      aria-label={clip.description}
    />
  );
}
