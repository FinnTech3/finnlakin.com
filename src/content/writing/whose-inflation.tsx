import { IntervalBand } from "@/components/charts";
import { Embed, Figures, Limits, Marginal, WrongFirst } from "@/components/prose";

export default function WhoseInflation() {
  return (
    <>
      <p>
        Inflation is announced as one number. That number is an average across
        everything people buy, weighted by how much of it they buy, so it
        describes a household spending something like 45% of its budget on
        housing, 17% on transport and 8% on medical care, all at once. Almost
        nobody has that budget. The average is real and carefully measured, and
        it describes a composite person who does not exist.
      </p>

      <p>
        The obvious next thought is that different households therefore live at
        different rates, persistently, and that the gap compounds into something
        large over a decade. That is what I set out to measure, and it is wrong.
        Averaged across ten years the baskets land within about a point of each
        other, and the cumulative difference comes to roughly 1%. On a ten-year
        view the headline is a decent summary of nearly everyone.
      </p>

      <p>
        What actually happens is that the disagreement is concentrated. It is
        small when inflation is low, and it opens up sharply when inflation is
        high.
      </p>

      <Figures
        items={[
          { value: "0.78 pp", label: "mean spread between households, headline below 3%, 56 months" },
          { value: "0.96 pp", label: "headline between 3% and 5%, 21 months" },
          { value: "2.45 pp", label: "headline at 5% and above, 24 months", tone: "flag" },
        ]}
      />

      <p>
        Three times wider in the shock than in the calm. The one national figure
        is least representative at precisely the moment it is quoted hardest, in
        pay negotiations, in benefit uprating, and in central bank press
        conferences.
      </p>

      <h2>Why the reconstruction comes first</h2>

      <p>
        Reweighting a basket and drawing a line is easy, and on its own it
        proves nothing, because a reader has no way to know whether the
        machinery underneath is sound. So the tool is built on a check it has to
        pass before any of this is allowed to be interesting.
      </p>

      <p>
        Take the eight published component indices, weight them by the{" "}
        <em>official</em> relative importances, and you should recover the
        published all-items rate. You do.
      </p>

      <Figures
        items={[
          { value: "0.083 pp", label: "mean absolute error against the published headline", tone: "pass" },
          { value: "101", label: "months compared" },
          { value: "0.42 pp", label: "worst single month, May 2021" },
        ]}
      />

      <p>
        The comparison is against a figure the BLS itself publishes to one
        decimal place. Everything the tool does afterwards is the same
        arithmetic with one table swapped, a household&rsquo;s weights instead of
        the official ones. Had the official weights failed to rebuild the
        official index, the honest response would have been to stop and find out
        why, not to publish household comparisons resting on a method that
        demonstrably does not work.
      </p>

      <Marginal label="On checks that cannot fail">
        There is a test pinning the reconstruction, and a second that feeds it
        deliberately wrong weights and asserts the check <em>fails</em>. A
        verification that cannot fail verifies nothing, and it is worth owning
        that the first version of this had only the passing half.
      </Marginal>

      <p>
        The residual error is not noise either. It peaks in 2021, and it peaks
        there because the rebuild uses one year&rsquo;s weights across the whole
        decade while the BLS re-estimates them annually. The reconstruction
        drifts most exactly where real spending patterns moved most. That is a
        satisfying kind of error, because it has a reason.
      </p>

      <WrongFirst struck="Different households live at persistently different inflation rates, and the gap compounds.">
        It does not compound. Over ten years the baskets converge to within
        about a point and the cumulative difference is around 1%, which is close
        to nothing. I had the shape of the answer backwards: the interesting
        variable is not <em>who</em> you are, it is <em>when</em> you are asking.
      </WrongFirst>

      <h2>March 2022</h2>

      <p>
        The clearest single month. The headline was 8.7%, and inside that one
        number two ordinary households were living three and a half percentage
        points apart.
      </p>

      <IntervalBand
        caption="Year-on-year inflation, March 2022"
        widthLabel="3.5 pp apart"
        low={{ value: "7.5%", note: "student" }}
        high={{ value: "11.0%", note: "car-dependent commuter" }}
        point={{ value: "8.7%", note: "published headline", at: 34 }}
        reading="Neither household is unusual, and neither is wrong about what they are experiencing. The commuter spends more of their budget on the thing that spiked, and the student spends less."
      />

      <p>
        This is also why people say, during an inflationary episode, that it
        feels worse than the official figure admits. For a good many baskets it
        genuinely is worse. Not because the statistic is wrong, but because it
        is an average, and averages hide their tails at exactly the moment the
        tails get long.
      </p>

      <h2>Set your own basket</h2>

      <p>
        The browser version runs the same reconstruction with eight sliders in
        front of it. Move them to match how you actually spend and it shows the
        rate you are living against the published one, and where the two came
        apart over the decade.
      </p>

      <Embed
        title="my-inflation, the browser calculator"
        src="https://finntech3.github.io/my-inflation/"
        href="https://finntech3.github.io/my-inflation/"
        linkLabel="Open the calculator in its own tab"
        note="The calculator runs entirely in the browser with the index data baked in, so it makes no network calls and there is no backend to be down."
      />

      <Limits>
        <p>
          It does not measure your spending. It lets you assert it. The output
          is only as good as the shares you set, and the presets are informed
          guesses rather than anybody&rsquo;s receipts.
        </p>
        <p>
          United States only, and eight expenditure groups rather than the full
          basket. Nothing here transfers to another country&rsquo;s index
          without redoing the work against that country&rsquo;s data.
        </p>
        <p>
          The arithmetic is a weighted sum of group rates, not a chained index.
          Over a twelve-month window the two agree closely, because the weights
          barely move inside a year. Over longer spans the chained calculation
          is the correct one, and this is not it.
        </p>
        <p>
          The household baskets are illustrative constructions. They are meant
          to show that the verdict moves with the situation, not to claim that
          any particular student or commuter spends precisely these shares.
        </p>
      </Limits>
    </>
  );
}
