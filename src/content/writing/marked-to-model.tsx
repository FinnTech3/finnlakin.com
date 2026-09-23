import { ProportionBar } from "@/components/charts";
import { Figures, Limits, Marginal, WrongFirst } from "@/components/prose";

export default function MarkedToModel() {
  return (
    <>
      <p>
        Every no-arbitrage relation on an option surface is stated relative to the
        forward. Put-call parity is a statement about the forward. A call spread
        is bounded by it. A butterfly is priced around it. Get the forward wrong
        and nothing else on the surface has to be wrong for the whole thing to
        look inconsistent, because every test you run is measuring from a mark
        that has moved.
      </p>

      <p>
        That is most of what I found. Deribit&rsquo;s mark surface breaks static
        arbitrage 11,593 times across 88 snapshots of the BTC and ETH chains. The
        venue&rsquo;s own bid and ask, scanned by the same code on the same
        snapshots, break it not once. And recovering the forward from the surface
        itself, rather than taking the one the venue publishes, improves the
        median violation sixteen fold.
      </p>

      <p>
        Eleven thousand broken prices is a dramatic number. One stale input is a
        boring one. The evidence points at the boring one.
      </p>

      <h2>Why a mark is not just a quote</h2>

      <p>
        Deribit publishes a mark price and a mark implied volatility for every
        listed option. These are not decoration and they are not the same thing
        as the price you would trade at. They set margin requirements, and they
        decide liquidations. If your position is marked against a surface, the
        surface is the thing that can close you out, regardless of where the
        order book actually is.
      </p>

      <p>
        So the question worth asking is not whether the marks are good estimates
        of fair value, which is unanswerable, but whether they are consistent
        with <em>themselves</em>. That is a much weaker test and a much more
        embarrassing one to fail.
      </p>

      <h2>The weakest test there is</h2>

      <p>
        Static arbitrage does not require a model, a volatility surface, or a
        view. It asks only whether a set of simultaneous prices can coexist
        without handing somebody a riskless profit: whether a spread costs less
        than nothing, whether a butterfly carries a negative price, whether more
        time can be worth less. No forecasting, no calibration, nothing about
        whether the market is right. Just internal consistency, checked in one
        instant.
      </p>

      <Figures
        items={[
          { value: "11,593", label: "violations in the mark surface", tone: "flag" },
          { value: "88", label: "snapshots, BTC and ETH" },
          { value: "235", label: "at or above one full tick" },
          { value: "0", label: "in the venue's own bid and ask", tone: "pass" },
        ]}
      />

      <ProportionBar
        caption="Violation magnitude, 88 snapshots"
        total={11593}
        parts={[
          { label: "At or above one full tick", value: 235, tone: "flag" },
          { label: "Smaller than a tick", value: 11358, tone: "neutral" },
        ]}
        reading="Two per cent of the violations are larger than the smallest increment the venue will quote. The rest are easy to wave away as rounding. The 235 are not."
      />

      <p>
        That two per cent is the part I would defend in a room. Everything
        below a tick can be argued down to rounding, and I would rather concede
        it than spend the argument there.
      </p>

      <p>
        The rate is steady rather than episodic: 155.8 violations per BTC
        snapshot and 107.7 per ETH snapshot. This is not a handful of bad
        moments. It is the ordinary state of the surface.
      </p>

      <WrongFirst struck="I set out to scan the quoted bid and ask for arbitrage.">
        There was none there at all, which should have been the end of the
        project. What actually happened is that my reconciliation against the
        marks failed first, and I spent a while assuming my own parser was
        broken before accepting that the clean series was the quotes and the
        inconsistent one was the surface the exchange margins you against.
      </WrongFirst>

      <h2>Sixteen fold</h2>

      <p>
        The diagnostic that matters is not the count. It is what happens when you
        stop trusting the published forward.
      </p>

      <p>
        Take the surface, discard the venue&rsquo;s forward, and back out the
        forward implied by the marks themselves. Re-run exactly the same scan.
        The median violation falls by a factor of sixteen. The inconsistency does
        not vanish, but the bulk of it was never eleven thousand independently
        wrong option prices. It was one number, wrong in a way that displaced
        everything measured against it.
      </p>

      <Marginal label="Why this matters more than the count">
        A surface with eleven thousand unrelated errors is broken and hard to
        fix. A surface with one stale input is coherent and cheap to fix. These
        have very different implications for anyone holding margined positions
        against it, and the count on its own cannot tell them apart.
      </Marginal>

      <p>
        There is a residue. Of 1,056 slices, 1,036 fitted and 20 refused. I have
        not explained the 20, and I would rather say so than fold them into an
        average.
      </p>

      <h2>Why any of this is checkable</h2>

      <p>
        A number nobody can reproduce is a claim. So the scan exists twice: once
        in Rust and once in Python, written to the same specification and
        compared output for output. Across the capture they agree byte for byte.
        Two implementations agreeing does not make them right, but it does rule
        out the most likely way for a result like this to be an artefact, which
        is a bug in the one implementation that produced it.
      </p>

      <p>
        The capture is committed to the repository. A fresh clone reproduces
        every figure above with no network access at all, which means the numbers
        cannot quietly change underneath the write-up when the venue&rsquo;s API
        does.
      </p>

      <Limits>
        <p>
          Marks are not tradeable prices. Nothing here is an arbitrage anybody
          could put on, and the top of book was clean throughout, so this is a
          statement about the margin surface rather than about free money.
        </p>
        <p>
          One venue. I have not checked whether other exchanges price their mark
          surfaces the same way, so nothing here generalises beyond Deribit.
        </p>
        <p>
          The violation lifetimes are censored by the snapshot interval: a
          violation that resolves between two snapshots is recorded as lasting
          until the next one. Every persistence figure is therefore a lower
          bound, not an estimate.
        </p>
        <p>
          The forward recovery is itself a model choice. It improves consistency
          by construction, so the sixteen fold figure should be read as evidence
          that the forward is the dominant term, not as proof that my forward is
          the correct one.
        </p>
      </Limits>
    </>
  );
}
