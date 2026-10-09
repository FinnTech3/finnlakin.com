const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

/* A count as a word, for the headings that say how many of something there are.

   Derived from the data and never typed, because a heading that says ten beside
   a list of eleven is the exact failure this site exists to argue against, and
   the way it happens is somebody editing the list and not the heading. Past
   twelve it falls back to the numeral, which is still true and only a little
   less graceful. */
export function numberWord(count: number, { capital = false } = {}): string {
  const word = WORDS[count] ?? String(count);
  return capital ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
