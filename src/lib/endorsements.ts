export type Endorsement = {
  id: string;
  quote: string;
  name: string;
  role: string;
  /* True where the quote has been cut. The design renders the ellipsis and
     says a cut was made, rather than passing a shortened quote off as whole. */
  trimmed: boolean;
  trimNote?: string;
};

/* These are other people's words. They keep their original punctuation and
   American or British spelling as written, which is why scripts/check-voice.mjs
   skips this file: correcting someone's quote to match a house style would be
   editing what they said. */
export const endorsements: Endorsement[] = [
  {
    id: "kosmarov",
    quote:
      "Finn ran our Bloomberg Trading Challenge team with the calm of someone twice his age. He set the thesis, structured how we sized positions, and ran the team retros honestly when trades went against us. […]",
    name: "Vadym Kosmarov",
    role: "Teammate, Bloomberg Global Trading Challenge 2024",
    trimmed: true,
    trimNote:
      "A closing sentence citing a performance figure has been cut, because no committed record of that figure exists and it should not appear on this site under anybody's name.",
  },
  {
    id: "du-cann",
    quote:
      "I've worked with Finn on London-based transaction advisory deals where precision and turnaround matter. His analytical output punches well above his year of study — the spreadsheets are clean, the assumptions are documented, and the commentary is sharp enough to drop straight into a client deck. He's one of the most commercially-minded students I've come across.",
    name: "William Du-Cann",
    role: "Collaborator, Transaction Advisory, London",
    trimmed: false,
  },
];
