import { Section } from "@/components/section";
import { buildMetadata } from "@/lib/metadata";
import { contact } from "@/lib/site";

export const metadata = buildMetadata({
  path: "/privacy",
  title: "Privacy",
  description:
    "What this site measures, what it stores, and why there is no cookie banner.",
  kicker: "Privacy",
});

export default function PrivacyPage() {
  return (
    <Section
      id="privacy"
      level={1}
      eyebrow="Privacy"
      title="What this site measures"
      intro="Short version: page views and how long a page was read, with no cookie, nothing stored on your device, and no way to identify you tomorrow from what was recorded today."
    >
      <div className="longform max-w-[68ch]">
        <h2>There is no cookie banner because there is no cookie</h2>
        <p>
          This site sets no cookie, writes nothing to <code>localStorage</code>,
          and stores nothing at all on your device. There is therefore nothing to
          consent to and nothing to opt out of storing, which is why you have not
          been asked.
        </p>

        <h2>How a visit is counted without identifying you</h2>
        <p>
          To count returning visits within a day without knowing who you are, the
          server derives an identifier by hashing your IP address, browser user
          agent and language header together under a key that is itself derived
          from a secret and <em>today&rsquo;s date</em>.
        </p>
        <p>
          Because the key changes at midnight UTC, yesterday&rsquo;s identifiers
          cannot be recomputed or matched against today&rsquo;s. A visitor is
          countable within a day and uncountable across days, by construction
          rather than by promise. Your IP address is never stored, only a hash of
          it.
        </p>

        <h2>What is recorded</h2>
        <ul>
          <li>The path you visited, and roughly how long the page was open.</li>
          <li>
            The host of the site that linked you here, if any. Not the full
            referring URL.
          </li>
          <li>
            Country, region and city, taken from headers the hosting platform
            adds. No third-party lookup service sees your address.
          </li>
          <li>Your viewport size, so the layout can be checked against real screens.</li>
        </ul>
        <p>
          The list of things that can be recorded is fixed in the server code.
          The endpoint accepts a closed set of event names and a closed set of
          field names, so it cannot be persuaded to store anything else by
          sending it something else.
        </p>

        <h2>Do Not Track</h2>
        <p>
          If your browser sends a Do Not Track signal, nothing is sent and nothing
          is recorded.
        </p>

        <h2>How long it is kept</h2>
        <p>
          Rows are deleted after ninety days. If the site is not configured with a
          secret to hash under, nothing is recorded at all rather than being
          recorded under a guessable key.
        </p>

        <h2>Anything else</h2>
        <p>
          Nothing on this site is financial advice. Results labelled simulated or
          illustrative are the output of models run over historical or
          user-supplied inputs and are not a record of trading. If you want
          something here corrected or removed, email{" "}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>.
        </p>
      </div>
    </Section>
  );
}
