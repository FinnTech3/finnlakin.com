"use client";

import { useSyncExternalStore } from "react";

/* The time where Finn is, ticking over as the minute does.

   Nothing on this site says whether he is available, and this does not either:
   it is the hour in the place the name is from, which is a small thing a
   person would say and a page does not usually bother to.

   Read as an external store, which is what a clock is. The server's snapshot is
   empty, because the server's clock is not the reader's and a time that
   differed between the two would be a hydration mismatch; the client's is the
   time, and React swaps one for the other after hydration without complaint.
   The slot is the width of the five digits from the start, in a face whose
   digits are all the same width, so nothing moves when the time arrives. It is
   aria-hidden: a clock that changes under a screen reader is noise, and the
   label beside it already says where the page is from. */
const ZONE = "Europe/London";

const format = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function subscribe(onChange: () => void) {
  const tick = setInterval(onChange, 10_000);
  return () => clearInterval(tick);
}

const snapshot = () => format.format(new Date());
const serverSnapshot = () => "";

export function LiveTime() {
  const time = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  return (
    <span aria-hidden="true" data-live-time="" className="inline-block min-w-[5ch] tabular-nums">
      {time || " "}
    </span>
  );
}
