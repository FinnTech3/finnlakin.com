"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { EventName } from "@/lib/analytics";

const ENDPOINT = "/api/analytics";
const HEARTBEAT_MS = 15_000;

type Meta = Record<string, string | number>;

function optedOut(): boolean {
  const nav = navigator as Navigator & {
    msDoNotTrack?: string;
    globalPrivacyControl?: boolean;
  };
  const legacy = (window as unknown as { doNotTrack?: string }).doNotTrack;
  return (
    nav.doNotTrack === "1" ||
    nav.msDoNotTrack === "1" ||
    legacy === "1" ||
    nav.globalPrivacyControl === true
  );
}

function send(event: EventName, meta: Meta): void {
  const payload = JSON.stringify({ event, meta });
  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(ENDPOINT, blob)) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch(ENDPOINT, {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

function referrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).host;
    return host === location.host ? undefined : host;
  } catch {
    return undefined;
  }
}

export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (optedOut()) return;

    const base: Meta = {
      path: pathname,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    };
    const from = referrerHost();
    send("page_view", from ? { ...base, referrer_host: from } : base);

    /* Its own event name. If dwell time were reported as another page_view,
       every view count would scale with how long the page stayed open and a
       ten minute read would land in the database as forty-one visits. */
    const startedAt = Date.now();
    const elapsed = () => Math.round((Date.now() - startedAt) / 1000);

    const timer = window.setInterval(() => {
      send("heartbeat", { path: pathname, seconds: elapsed() });
    }, HEARTBEAT_MS);

    /* Each heartbeat carries cumulative seconds, so the dashboard takes the
       maximum per visitor and path rather than summing them. */
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        send("heartbeat", { path: pathname, seconds: elapsed() });
      }
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [pathname]);

  useEffect(() => {
    if (optedOut()) return;

    /* This listener is never gated on event.defaultPrevented. next/link calls
       preventDefault() in its own React handler and React delegates to the
       document, so defaultPrevented is true here for every internal link, and
       a guard on it would silently switch this off for internal navigation.
       Interest is declared by an explicit attribute instead. */
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const tagged = target.closest<HTMLElement>("[data-analytics-event]");
      if (tagged) {
        const name = tagged.dataset.analyticsEvent as EventName | undefined;
        if (name) send(name, { path: pathname, target: tagged.dataset.analyticsTarget ?? "" });
        return;
      }

      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (!href.startsWith("http")) return;
      try {
        const url = new URL(href);
        if (url.host === location.host) return;
        send("outbound_click", { path: pathname, target: `${url.host}${url.pathname}` });
      } catch {
        /* not a URL we can attribute */
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname]);

  return null;
}
