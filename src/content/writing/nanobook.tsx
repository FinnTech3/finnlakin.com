import { ProportionBar } from "@/components/charts";
import { Figures, Limits, Marginal, WrongFirst } from "@/components/prose";

export default function Nanobook() {
  return (
    <>
      <p>
        A limit order book indexed by price wants to be one flat array. Every
        price is a slot, an update is a bounds check and a store, and there is
        no tree to walk and no hash to compute. It is the fastest structure
        available and it is the first one anybody sketches.
      </p>

      <p>
        The only question is how large the array has to be, and that is not a
        design question. It is a measurement. So before writing any of the
        structure I pulled a real Coinbase book and looked at what it actually
        contains.
      </p>

      <Figures
        items={[
          { value: "42,700", label: "resting levels in the snapshot" },
          { value: "13.9bn", label: "one-cent ticks between the lowest bid and the highest ask" },
          { value: "91.8%", label: "of writes that landed in the window this measurement chose", tone: "pass" },
          { value: "9.2×", label: "faster than a BTreeMap at the operation that dominates" },
        ]}
      />

      <h2>What the snapshot said</h2>

      <p>
        Twenty-one thousand bids, twenty-one thousand asks, and a price range
        running from one cent to just under 139 million dollars. Somebody is
        bidding a cent for a Bitcoin. Somebody else is offering one at the
        price of a small airport. Both orders are real, both are resting, and
        both are as far from the touch as it is possible to be.
      </p>

      <p>
        Between those two prices sit 13,899,102,340 one-cent ticks. A flat
        array covering all of them, at the eight bytes a size needs, is more
        than a hundred gigabytes of almost entirely zero.
      </p>

      <WrongFirst struck="A price-indexed book is a flat array over the tick range, so the first job is to allocate one.">
        The array is right and the range is wrong. That distinction only exists
        because the snapshot came before the code: had I sized the array from
        the prices I expected rather than the prices that were there, the
        structure would have been correct in shape and unbuildable in practice,
        and I would have found out after writing it rather than before.
      </WrongFirst>

      <h2>The same measurement says what to build</h2>

      <p>
        The interesting part of the snapshot is not the span. It is how little
        of the book uses it. Counting levels by distance from the mid:
      </p>

      <ProportionBar
        caption="Where the 42,700 resting levels actually sit"
        total={42700}
        parts={[
          { label: "Within 10% of the mid", value: 7045, tone: "neutral" },
          { label: "Further out than that", value: 35655, tone: "neutral" },
        ]}
        reading="Inside a tenth of a per cent of the mid there are 234 levels, 0.5% of the book. Inside one per cent, 723. The band within ten per cent holds 7,045, and it spans about 1.55 million ticks out of 13.9 billion: roughly a hundredth of one per cent of the range carries a sixth of the levels. The rest is dust parked where nothing trades."
      />

      <p>
        So the array survives. It just has to cover a window around the touch
        rather than the whole range. The window is 2<sup>18</sup> ticks wide,
        and anything outside it goes into an ordered map that the hot path
        consults only when the windowed side is empty. Replaying the captured
        session, 91.8% of writes landed in the flat array and the window never
        needed recentring.
      </p>

      <Marginal label="What the window bought">
        Sizes live in the flat window, so an update is a bounds check and a
        store. Occupancy lives in a three-level bitmap: one bit per tick, one
        per 64 ticks, one per 4,096. Finding the best price is three loads and
        three leading-zero instructions however many levels are resting, and
        the upper two bitmap levels are 520 bytes together, so they stay in L1
        rather than being fetched. Prices never touch a float:{" "}
        <code>&quot;77543.41&quot;</code> is parsed digit by digit into{" "}
        <code>7754341</code>, and a quote carrying more precision than the grid
        allows is rejected rather than rounded, because a venue quoting
        half-ticks means something has changed and that deserves a loud
        failure.
      </Marginal>

      <h2>A speed claim needs a correctness proof</h2>

      <p>
        A structure chosen for the machine is only worth anything if it
        reconstructs the same book as a structure chosen for clarity. So there
        is a second implementation, in Python, written to be readable rather
        than fast: a dictionary per side, sorted on the way out, no window and
        no bitmap.
      </p>

      <p>
        The same twenty-minute capture goes through both. 736,997 individual
        changes, 42,812 resting levels at the close, and the two dumps are byte
        for byte identical. CI runs that differential on every push against a
        committed sample, so the claim is not a thing I checked once.
      </p>

      <Figures
        items={[
          { value: "736,997", label: "changes replayed through both implementations", tone: "pass" },
          { value: "0", label: "differing levels between them", tone: "pass" },
          { value: "99.41%", label: "agreement with the exchange's own bid snapshots" },
          { value: "-0.02 pp", label: "drift per 10,000 updates, against 1.1 points of snapshot noise", tone: "pass" },
        ]}
      />

      <p>
        Two implementations agreeing is still the code marking its own
        homework, so the capture also takes a REST snapshot from Coinbase every
        thirty seconds. Those come from the venue. Across 42 of them, agreement
        averaged 99.41% on bids and 99.54% on asks.
      </p>

      <p>
        That gap is not swept away, and it is not evidence of a bug. The
        streaming feed and the REST endpoint are not synchronised, and the
        batched level 2 channel carries no per-message sequence number to align
        them with, so exact agreement is not the result to expect. What
        separates a sound reconstruction from a drifting one is the trend, and
        the trend is flat: 0.02 percentage points per 10,000 updates on bids
        and 0.04 on asks, both negative, against snapshot-to-snapshot noise
        spanning about 1.1 points. The disagreement is the race between two
        views of the same book, not decay in one of them.
      </p>

      <p>
        Every internal check has a paired test that feeds it deliberately
        broken input and asserts that it fails. A check that cannot fail is not
        a check.
      </p>

      <h2>Where it loses</h2>

      <p>
        Two benchmarks go the other way and both are structural. Re-reading a
        best price that has not moved is 2.3 times slower than a{" "}
        <code>BTreeMap</code>, whose path to the rightmost node stays hot and
        perfectly predicted, while three loads spread over a two-megabyte array
        do not. Reading the top ten levels is 1.6 times slower, because the
        bitmap has to cross the empty price space between them: in the real
        book the top ten bids span 823 ticks, an occupancy of 1.22%, so the
        cursor scans about thirteen words of mostly zeros to return ten
        answers.
      </p>

      <p>
        Neither is a bug and no tuning removes either. They are what the window
        costs. The trade is the right way round for this workload because the
        captured session took 736,997 writes, and in a feed handler updates
        outnumber depth queries by orders of magnitude. If the job were mostly
        walking depth, the answer would be a tree.
      </p>

      <h2>Lineage</h2>

      <p>
        This is the fast half of a pair. The Python simulator it was written
        against,{" "}
        <a href="https://github.com/FinnTech3/orderbook-sim">orderbook-sim</a>,
        reconstructs the same book with a dictionary and a sorted list and was
        written to be right rather than quick.{" "}
        <a href="https://github.com/FinnTech3/orderbook-live">orderbook-live</a>{" "}
        runs that reconstruction in a browser against the live feed. This one
        asks what the same job costs when the structure is chosen for the
        machine instead.
      </p>

      <Limits>
        <p>
          The absolute nanosecond figures were measured on a shared cloud
          instance with no pinned cores and no fixed clock governor, which is
          the wrong environment for absolute latency claims. They are
          indicative. The ratios are the claim, and every benchmark runs the{" "}
          <code>BTreeMap</code> alongside in the same run precisely so that a
          back-to-back comparison survives noise a raw figure would not.
        </p>
        <p>
          The headline 5 nanoseconds is one microbenchmark, updating the size
          at a level that already exists. Replaying the real session, which
          includes inserts, removals and the touch moving, costs 22 nanoseconds
          at the median and 542 at the 99.9th percentile. Those are different
          measurements of different things and the larger one is the one a feed
          handler would live with.
        </p>
        <p>
          This is an aggregated price-level book, not order-by-order, because
          that is what the venue publishes on this feed. There is no matching
          engine, no order entry and no threading. It is a single-threaded data
          structure, and the lock-free queue that would feed it from a network
          thread is not written.
        </p>
        <p>
          It reconstructs the dust at one cent and at 139 million faithfully
          rather than banding it away, which a production system would not
          bother to do. That is deliberate: the reconstruction has to stay
          complete to be checkable against the venue at all.
        </p>
      </Limits>
    </>
  );
}
