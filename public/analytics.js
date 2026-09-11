/* Deliberately a plain static script rather than a React component.

   It used to be a client component driven by usePathname, which meant the
   first page view could not be sent until React had hydrated. On a mid-range
   phone that is seconds after paint, so anyone who read the page and left
   quickly was never counted at all. As a deferred script this runs as soon as
   the document is parsed, which is the whole point of measuring in the first
   place.

   The event names and field names below are a closed list that must match
   src/lib/analytics.ts exactly. A test asserts that they do, so the two cannot
   drift apart. */
(function () {
  "use strict";

  var ENDPOINT = "/api/analytics";
  var HEARTBEAT_MS = 15000;

  /* These two mirror EVENT_NAMES and META_KEYS in src/lib/analytics.ts, and a
     test asserts they match exactly. The server rejects anything outside them
     anyway; filtering here as well means a mistake in this file shows up as a
     missing field rather than as a request the collector throws away, and it
     guarantees nothing unexpected ever leaves the browser. */
  var EVENTS = [
    "page_view",
    "heartbeat",
    "palette_open",
    "cv_download",
    "outbound_click",
    "writing_progress",
  ];
  var FIELDS = ["path", "slug", "referrer_host", "target", "seconds", "viewport"];

  var nav = navigator;
  if (
    nav.doNotTrack === "1" ||
    nav.msDoNotTrack === "1" ||
    window.doNotTrack === "1" ||
    nav.globalPrivacyControl === true
  ) {
    return;
  }

  function send(event, meta) {
    if (EVENTS.indexOf(event) === -1) return;

    var clean = {};
    for (var i = 0; i < FIELDS.length; i++) {
      var key = FIELDS[i];
      if (meta[key] !== undefined && meta[key] !== null && meta[key] !== "") {
        clean[key] = meta[key];
      }
    }

    var payload = JSON.stringify({ event: event, meta: clean });
    try {
      if (nav.sendBeacon(ENDPOINT, new Blob([payload], { type: "application/json" }))) {
        return;
      }
    } catch (error) {
      /* fall through to fetch */
    }
    fetch(ENDPOINT, {
      method: "POST",
      body: payload,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(function () {});
  }

  function referrerHost() {
    if (!document.referrer) return null;
    try {
      var host = new URL(document.referrer).host;
      return host === location.host ? null : host;
    } catch (error) {
      return null;
    }
  }

  var startedAt = Date.now();
  var currentPath = location.pathname;
  var timer = null;

  function elapsed() {
    return Math.round((Date.now() - startedAt) / 1000);
  }

  function beat() {
    /* Its own event name. If dwell were reported as another page_view, every
       view count would scale with how long the page stayed open, and a ten
       minute read would land in the database as dozens of visits. Each beat
       carries cumulative seconds, so the dashboard takes the maximum per
       visitor and path rather than summing them. */
    send("heartbeat", { path: currentPath, seconds: elapsed() });
  }

  function startPage(path) {
    currentPath = path;
    startedAt = Date.now();

    var meta = {
      path: path,
      viewport: window.innerWidth + "x" + window.innerHeight,
    };
    var from = referrerHost();
    if (from) meta.referrer_host = from;
    send("page_view", meta);

    if (timer !== null) clearInterval(timer);
    timer = setInterval(beat, HEARTBEAT_MS);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") beat();
  });

  /* Client-side navigation, without needing the router. The Navigation API
     covers current Chromium and Safari; popstate is the fallback, and a
     wrapped pushState catches the rest. */
  if (window.navigation && typeof window.navigation.addEventListener === "function") {
    window.navigation.addEventListener("navigate", function (event) {
      try {
        var next = new URL(event.destination.url).pathname;
        if (next !== currentPath) setTimeout(function () { startPage(next); }, 0);
      } catch (error) {
        /* not a navigation we can attribute */
      }
    });
  } else {
    var push = history.pushState;
    history.pushState = function () {
      push.apply(this, arguments);
      if (location.pathname !== currentPath) startPage(location.pathname);
    };
    window.addEventListener("popstate", function () {
      if (location.pathname !== currentPath) startPage(location.pathname);
    });
  }

  /* Never gated on event.defaultPrevented. Framework links call
     preventDefault() in their own handler and the event is delegated to the
     document, so defaultPrevented is true here for every internal link, and a
     guard on it would silently switch this off for internal navigation.
     Interest is declared by an explicit attribute instead. */
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;

    var tagged = target.closest("[data-analytics-event]");
    if (tagged) {
      send(tagged.getAttribute("data-analytics-event"), {
        path: currentPath,
        target: tagged.getAttribute("data-analytics-target") || "",
      });
      return;
    }

    var link = target.closest("a");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.indexOf("http") !== 0) return;
    try {
      var url = new URL(href);
      if (url.host === location.host) return;
      send("outbound_click", { path: currentPath, target: url.host + url.pathname });
    } catch (error) {
      /* not a URL we can attribute */
    }
  });

  startPage(location.pathname);
})();
