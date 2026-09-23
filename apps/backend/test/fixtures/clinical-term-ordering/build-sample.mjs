// Builds the crowded-page query sample for the ordering half of #3375. Deterministic: a
// fixed stride over the concepts sorted by ycCode, no randomness and no hand-picking, so
// the sample can be rebuilt and disagreed with.
//
// The recall sample next door measures whether the right concept is reachable. This one
// measures what the first page looks like once it is, which is the complaint in the
// issue body: "renal" matches 119 concepts and the first page is alphabetical noise.
//
// A query qualifies if it is the first word of some concept's label and at least
// MIN_CROWD concepts share that prefix. Below that the page is not crowded and the order
// inside a tier decides nothing.
import fs from "node:fs";

const [source, out] = process.argv.slice(2);
const WANT = 60;
const MIN_CROWD = 15;
const MIN_WORD_LENGTH = 4;

const concepts = JSON.parse(fs.readFileSync(source, "utf8"))
  .filter((c) => c.active !== false)
  .sort((a, b) => a.ycCode.localeCompare(b.ycCode));

const words = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// The display-prefix tier, which is the tier the issue's example is stuck in. Counting
// it here rather than the whole match set keeps the sample to queries whose first page
// is decided by the tiebreak alone.
const prefixMatches = (query) => {
  const q = query.toLowerCase();
  return concepts.filter((c) => c.label.toLowerCase().startsWith(q)).length;
};

const candidates = [];
const seen = new Set();
for (const concept of concepts) {
  const first = words(concept.label)[0];
  if (!first || first.length < MIN_WORD_LENGTH) continue;
  const query = first.toLowerCase();
  if (seen.has(query)) continue;
  seen.add(query);
  const matches = prefixMatches(query);
  if (matches < MIN_CROWD) continue;
  candidates.push({ query, matches });
}

// A fixed stride over the qualifying queries, in ycCode order of the concept that
// contributed each one, so which 60 appear is decided by the vocabulary's own ordering.
const step = Math.max(1, Math.floor(candidates.length / WANT));
const cases = [];
for (let i = 0; i < candidates.length && cases.length < WANT; i += step) {
  cases.push({ kind: "crowded", ...candidates[i], expected: null });
}

// The issue names this one, so it is in the sample whether or not the stride picked it.
if (!cases.some((c) => c.query === "renal")) {
  const renal = candidates.find((c) => c.query === "renal");
  if (!renal) throw new Error('no crowded query "renal" in the vocabulary');
  cases.push({ kind: "crowded", ...renal, expected: null });
}

fs.writeFileSync(out, `${JSON.stringify(cases, null, 2)}\n`);
console.log(
  JSON.stringify({ qualifying: candidates.length, sampled: cases.length, out }),
);
