// Builds the query sample for #3375. Deterministic: a fixed stride over the concepts
// sorted by ycCode, no randomness and no hand-picking, so the sample can be rebuilt
// and disagreed with.
import fs from "node:fs";

const [source, out] = process.argv.slice(2);
const concepts = JSON.parse(fs.readFileSync(source, "utf8"))
  .filter((c) => c.active !== false)
  .sort((a, b) => a.ycCode.localeCompare(b.ycCode));

const words = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const cases = [];
const seen = new Set();
const push = (kind, query, expected, note) => {
  const key = query.toLowerCase();
  if (!query || seen.has(key)) return false;
  seen.add(key);
  cases.push({ kind, query, expected, note });
  return true;
};

// A. Named in the issue and in the maintainer's split comment. The expected code is
// looked up from the vocabulary by label rather than written down, so the sample cannot
// assert an answer that is not in the shipped data.
const byLabel = (label) => {
  const hits = concepts.filter(
    (c) => c.label.toLowerCase() === label.toLowerCase(),
  );
  if (hits.length === 0) throw new Error(`no concept labelled ${label}`);
  return hits[0].ycCode;
};
push(
  "issue",
  "ear infection",
  byLabel("Ear (aural) infection"),
  "issue body: returns nothing today",
);
push("issue", "renal failure", byLabel("Renal failure"), "maintainer comment");
push(
  "issue",
  "renal",
  null,
  "issue body: an ordering complaint, not a recall one",
);

// B. Word order reversed. The concept's own wording, in an order a clinician may
// legitimately use ("externa otitis"). No shipped term contains the reversed phrase as a
// substring, so the whole-phrase prefilter cannot reach it.
const stride = (list, want, fn) => {
  const step = Math.max(1, Math.floor(list.length / want));
  let taken = 0;
  for (let i = 0; i < list.length && taken < want; i += step) {
    if (fn(list[i])) taken += 1;
  }
  return taken;
};

const multiWord = concepts.filter((c) => words(c.label).length >= 2);
stride(multiWord, 30, (c) => {
  const w = words(c.label);
  const reversed = [...w].reverse().join(" ");
  if (reversed.toLowerCase() === w.join(" ").toLowerCase()) return false;
  return push(
    "reordered",
    reversed,
    c.ycCode,
    `reversed wording of ${c.label}`,
  );
});

// C. First and last word of a longer label - the head and the qualifier, with the
// connective words a clinician would drop.
const longLabel = concepts.filter((c) => words(c.label).length >= 4);
stride(longLabel, 15, (c) => {
  const w = words(c.label);
  return push(
    "shortened",
    `${w[0]} ${w[w.length - 1]}`,
    c.ycCode,
    `head+tail of ${c.label}`,
  );
});

// D. A SNOMED designation whose wording differs from the VeNom label, used verbatim.
// These already work today: the designation is in the search text, so the whole phrase
// matches. They are the control that widening does not disturb what already worked.
const alternate = concepts.filter((c) =>
  (c.designations ?? []).some(
    (d) =>
      d.term.toLowerCase() !== c.label.toLowerCase() &&
      words(d.term).length >= 2,
  ),
);
stride(alternate, 15, (c) => {
  const d = (c.designations ?? []).find(
    (x) =>
      x.term.toLowerCase() !== c.label.toLowerCase() &&
      words(x.term).length >= 2,
  );
  return push(
    "designation",
    d.term,
    c.ycCode,
    `alternate wording of ${c.label}`,
  );
});

// E. Single-word queries. The change is defined to leave these untouched, so they are
// the control that says so against the real database rather than against the SQL text.
stride(concepts, 10, (c) => {
  const w = words(c.label);
  return push(
    "single-word",
    w[0],
    null,
    "control: must be identical before and after",
  );
});

fs.writeFileSync(out, `${JSON.stringify(cases, null, 2)}\n`);
console.log(
  JSON.stringify({
    total: cases.length,
    byKind: cases.reduce(
      (a, c) => ({ ...a, [c.kind]: (a[c.kind] ?? 0) + 1 }),
      {},
    ),
  }),
);
