import Link from "next/link";

import { IntervalBand } from "@/components/charts";
import { Figures, Limits, Marginal, WrongFirst } from "@/components/prose";

export default function TermPremium() {
  return (
    <>
      <p>
        The ten-year Treasury yield is part expectation and part compensation.
        Some of it is the average short rate markets expect over the next
        decade. The rest is the term premium, the extra yield demanded for
        holding a long bond instead of rolling bills. The New York Fed publishes
        that split monthly, back to 1961, from the Adrian-Crump-Moench model,
        and commentary quotes the result to the basis point.
      </p>

      <p>
        Rebuilding the model from the yield curve up gives two numbers that sit
        very badly together. The fitted curve comes back to within half a basis
        point. The premium drawn out of that same curve comes back to fourteen.
      </p>

      <Figures
        items={[
          { value: "0.45 bp", label: "median error on the published fitted yields", tone: "pass" },
          { value: "14 bp", label: "median error on the risk-neutral yield, and so on the premium", tone: "flag" },
          { value: "0.9997", label: "correlation with the Fed's published ten-year premium" },
          { value: "81 bp", label: "movement in the premium from the start date alone", tone: "flag" },
        ]}
      />

      <h2>Verify before interpreting</h2>

      <p>
        Nothing the model says about the term premium means anything if it
        cannot reproduce the yields the premium is extracted from, so that is
        the first thing to check. It reproduces them. Across every maturity from
        one to ten years and every month from 1961, the fitted yields match the
        published series to a median of 0.45 basis points, a 99th percentile of
        2.8, and a worst case of 9.
      </p>

      <p>
        That is the part of an affine term structure model which is identified.
        The cross-section of the curve is over-determined, and a sound estimator
        nails it.
      </p>

      <Marginal label="Why this model is worth rebuilding at all">
        The estimator is not a likelihood to maximise or a filter to run. It is
        three ordinary least squares regressions in sequence: a vector
        autoregression for the factors, a regression of one-month excess bond
        returns on the factor innovations and their lags, and a cross-sectional
        step that turns those into prices of risk. All closed form, so all
        reproducible exactly, in a few dozen lines of arithmetic with no
        numerical library underneath.
      </Marginal>

      <h2>Where the certainty runs out</h2>

      <p>
        With prices of risk in hand the model runs two bond-pricing recursions.
        One compensates investors for risk and gives the yield. The other sets
        the prices of risk to zero and gives the risk-neutral yield, which is
        what the curve would be if duration carried no premium at all. The term
        premium is the gap between them.
      </p>

      <p>
        The risk-neutral yield reconstructs to a median of 14 basis points
        against the published series. That is roughly thirty times looser than
        the fitted yield it is subtracted from, and the premium, being the
        complement, inherits exactly that error. The ten-year premium still
        tracks the Fed&rsquo;s at a correlation of 0.9997, so the shape and the
        timing are right. It is the level that floats.
      </p>

      <WrongFirst struck="The 14 basis point gap is a discrepancy, and somewhere there is a convention I have got wrong.">
        There is no bug to find. Estimate the same model on the same data from
        different sample starts and the premium moves far further than fourteen
        basis points while the yield fit barely moves at all. The gap is not an
        error against the Fed&rsquo;s number, it is a small corner of the band
        that any honest reconstruction lives inside.
      </WrongFirst>

      <h2>The level is a choice, not a measurement</h2>

      <p>
        The clearest way to see how soft the level is: hold the model and the
        data fixed, change only where the estimation sample begins, and watch.
      </p>

      <IntervalBand
        caption="Recent ten-year term premium, same model, same data"
        widthLabel="81 bp wide"
        low={{ value: "0.00%", note: "estimating from 1961" }}
        high={{ value: "0.82%", note: "estimating from 2000" }}
        reading="Across every one of those choices the fitted yields stay inside two basis points. Adding or removing a principal component moves the premium again, by another dozen."
      />

      <p>
        So the level of the term premium is not a number the data hands you. It
        is a number a modelling decision hands you, and different defensible
        decisions hand you numbers that disagree by most of a percentage point.
        Reproducing the Fed&rsquo;s exact level would mean matching a set of
        estimation choices to the basis point. It would not mean the level was
        any better identified.
      </p>

      <h2>Why it matters</h2>

      <p>
        A single figure, quoted to the basis point in commentary and used to
        argue about whether long rates are too high or too low, turns out to be
        identified only to within tens of basis points, even when the curve it
        comes from is fit almost perfectly.
      </p>

      <p>
        The uncertainty is not sampling noise that more data would shrink. It is
        specification dependence, and it is largest at exactly the long
        maturities the number is quoted for. That is the same lesson as{" "}
        <Link href="/writing/whose-inflation">the CPI reconstruction</Link> in a
        different market: a headline everyone treats as measured turns out to
        depend on a choice, and the choice is where the story is.
      </p>

      <Limits>
        <p>
          This is not a claim to reproduce the Fed&rsquo;s published term
          premium level to the basis point. That level is one point in a wide
          band, and saying so is better than tuning conventions until the
          numbers coincide.
        </p>
        <p>
          It is not a trading signal. The premium is a decomposition, not a
          forecast, and nothing here says whether a long bond is cheap.
        </p>
        <p>
          The 81 basis point figure is the spread across the start dates I
          tried. It is a demonstration that the level is specification
          dependent, not a confidence interval, and it should not be read as one.
        </p>
      </Limits>
    </>
  );
}
