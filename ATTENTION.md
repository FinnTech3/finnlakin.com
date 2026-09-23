# What actually holds a reader, and what this site does about it

Commissioned as "deep research on what it is that actually keeps a user
fixated: what little things on a website, whether it's colour, text size,
fonts, or anything that's related to that."

The short version is that the evidence is much thinner than the industry's
confidence about it, and where it is solid it mostly tells you to do less. What
follows separates the two, because the useful part of this exercise is knowing
which of these is a finding and which is a habit somebody wrote down once.

## The rule about numbers applies here too

This site's whole argument is that you should be able to check where a number
came from. Several figures that turn up everywhere in this literature are
repeated out of marketing posts with no study behind them: colour making people
read "60% faster", bad palettes raising error rates "by up to 30%", stock
photography being ignored "85% of the time". They are not printed here. Where a
number appears below it has a paper behind it, and where there is no sound
number the finding is stated in words instead.

## What the evidence supports

**Low to medium visual complexity beats high, and it is decided before anyone
has read anything.** Tuch and colleagues showed 119 real sites to participants
at exposures from 1000ms down to 17ms. High visual complexity produced a worse
first impression than medium or low at every exposure, and the effect was
present at **17 milliseconds**, which is less than a single frame at 60Hz.
Prototypicality, meaning how much a page looks like other pages of its kind,
helped as well, though less strongly.

The practical reading of this is uncomfortable for anyone building something
elaborate: the judgement is made before the content exists for the reader. It
is made on density, on how busy the frame is, on whether the thing looks like
what it is.

**People scan in patterns, and headings are what they land on.** The Nielsen
Norman Group's eyetracking corpus identifies four patterns: F, spotted,
layer-cake and commitment. The layer-cake pattern, fixations on headings and
subheadings with the body text skipped between them, is the most efficient
scan there is short of reading every word. The F-pattern is what happens when
the page gives a reader nothing better: it is a symptom of weak structure, not
a layout to design for.

So the highest-leverage typography on a page is not the body text. It is the
headings, and whether they say anything on their own.

**Line length is real and the range is narrow.** Bringhurst's 45 to 75
characters is the classic guideline; Dyson and Haselgrove's experimental work
puts around 55 characters as supporting effective reading at both normal and
fast speeds. Long lines make people skim. Line height should rise with line
length, with 1.5 as the floor.

**Serif versus sans is not a performance question.** Repeated studies,
including Bernard and Mills and the Wichita State usability lab work, find no
statistically significant difference in reading speed or comprehension between
well-made serif and sans faces on screen. What does move is familiarity and
subjective preference. This means the choice of typeface is a matter of voice
and fit, and anyone claiming a reading-speed benefit for their favourite is
overstating it.

**Colour works by restraint, and meaning must never live in hue alone.**
Roughly 8% of men have a colour vision deficiency, red-green by far the most
common, so red against green as the only carrier of a verdict is a verdict a
substantial minority cannot read. The practitioner consensus, which is
consistent across sources, is one accent, one highlighted series, everything
else muted.

**Generic imagery is ignored.** The banner-blindness research is three decades
deep and consistent: readers skip anything that reads as decoration or
advertising, and they make that decision in peripheral vision before fixating.
What does pull attention is imagery that is evidently specific and real. The
implication for a portfolio is blunt and is the single most actionable finding
here: **a screen recording of your own software running is worth more than any
stock clip**, and stock B-roll beside a result is the category of image readers
have trained themselves to skip.

## What the evidence does not support

**Motion as an engagement tactic.** The parallax literature is the clearest
case. A 2024 HCI International usability study found participants were on
average *faster* on the non-parallax version, with no significant difference in
total task time or errors, and another found no significant difference in
perceived usability, enjoyment, satisfaction or visual appeal. Two participants
suffered motion sickness. The one thing parallax reliably raises is perceived
coolness and vividness, and that is worth something in a hedonic context, but
it does not survive being described as a usability improvement.

This is a finding against interest for this site, which has a thirty thousand
particle brain in it. The honest conclusion is not that the brain should go. It
is that **the brain has to earn its place as the thing itself rather than as an
engagement device**, and that it must never cost the reading. Which is exactly
the constraint the column mask now enforces.

**Colour psychology as commonly told.** The claim that specific hues reliably
produce specific emotional responses does not replicate well and is heavily
culture-bound. Red is the interesting case: its emotional connotation switches
between negative and positive depending on context, and what is stable is not
the valence but the *salience*. Red says "look here", not "this is bad".

Which is the precise reason Finn's complaint about red on this site is correct,
and correct for a better reason than he gave. Red is not a mood, it is an
attention budget, and this site has been spending it on anything merely notable
rather than on the few things that are genuinely a failure.

## The conclusion

Ranked by how much the evidence supports it against how much it costs to do:

1. **Headings carry the page.** They are what the eye lands on. They should be
   readable as a standalone summary from top to bottom.
2. **Reduce density before adding anything.** The first impression is formed on
   complexity, at 17ms, and nothing added later recovers it.
3. **Hold the measure at 45 to 75 characters** with line height at 1.5 or
   above. This site already does, at 66ch.
4. **Spend colour like a budget.** One accent. Red reserved for the genuinely
   negative, and never as the only signal.
5. **Real imagery or none.** Specific beats decorative, and stock beside a
   result is worse than white space because it trains the reader to skip that
   region.
6. **Motion has to be the content, not the garnish**, must never delay or
   obstruct reading, and must respect `prefers-reduced-motion`.
7. **Typeface is voice, not speed.** Choose for character and familiarity and
   stop claiming otherwise.

## What changed here as a result

- Red is restricted to findings that are genuinely a failure. Anything that is
  a deliberate trade-off or merely notable takes a neutral.
- The particle cloud is cut to its own column so that it can never cost the
  reading, which is the only basis on which the motion is defensible at all.
- The hero is rebuilt for lower density at first paint.
- The case for real screen recordings over stock B-roll beside each project is
  now evidence-backed rather than a preference, and is put to Finn as such.

## Sources

- Tuch, Presslaber, Stöcklin, Opwis and Bargas-Avila, "The role of visual
  complexity and prototypicality regarding first impression of websites",
  *International Journal of Human-Computer Studies* 70(11), 2012.
  <https://doi.org/10.1016/j.ijhcs.2012.06.003>
- Nielsen Norman Group, "Text Scanning Patterns: Eyetracking Evidence".
  <https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/>
- Nielsen Norman Group, "The Layer-Cake Pattern of Scanning Content on the Web".
  <https://www.nngroup.com/articles/layer-cake-pattern-scanning/>
- Nielsen Norman Group, "Banner Blindness Revisited: Users Dodge Ads on Mobile
  and Desktop".
  <https://www.nngroup.com/articles/banner-blindness-old-and-new-findings/>
- Dyson and Haselgrove, on line length and reading speed; reviewed in "Optimal
  Line Length in Reading, A Literature Review", *Visible Language*, 2005.
  <https://journals.uc.edu/index.php/vl/article/view/5765>
- "A Usability Investigation of Parallax Scrolling for Web Pages", HCI
  International 2024 Late Breaking Papers.
  <https://doi.org/10.1007/978-3-031-76821-7_9>
- Sundar et al., "How does Parallax Scrolling Influence User Experience? A Test
  of TIME".
  <https://pure.psu.edu/en/publications/how-does-parallax-scrolling-influence-user-experience-a-test-of-t>
- "How Serif and Sans Serif Typefaces Influence Reading on Screen: An Eye
  Tracking Study", 2016. <https://doi.org/10.1007/978-3-319-40355-7_55>
