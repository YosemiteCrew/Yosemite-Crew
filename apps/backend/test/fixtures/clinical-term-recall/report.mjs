import fs from "node:fs";
const [basePath, headPath] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8")).results;
const head = JSON.parse(fs.readFileSync(headPath, "utf8")).results;

const codes = (r) => r.top10.map((t) => t.ycCode);
const prefixViolations = [];
const singleWordViolations = [];
let identical = 0;

for (let i = 0; i < base.length; i += 1) {
  const b = codes(base[i]);
  const h = codes(head[i]);
  const isPrefix = b.every((c, j) => h[j] === c);
  if (!isPrefix) prefixViolations.push({ q: base[i].query, b, h });
  if (JSON.stringify(b) === JSON.stringify(h)) identical += 1;
  if (
    base[i].kind === "single-word" &&
    JSON.stringify(b) !== JSON.stringify(h)
  ) {
    singleWordViolations.push({ q: base[i].query, b, h });
  }
}

const withExpected = base
  .map((b, i) => ({ b, h: head[i] }))
  .filter(({ b }) => b.expected);
const recall = (rows, arm) =>
  rows.filter((r) => r[arm].expectedPosition > 0).length;
const meanPos = (rows, arm) => {
  // Absent from the top 10 is scored 11, so a query that never surfaces the concept
  // cannot be dropped from the mean and flatter it.
  const vals = rows.map((r) =>
    r[arm].expectedPosition > 0 ? r[arm].expectedPosition : 11,
  );
  return vals.reduce((a, v) => a + v, 0) / vals.length;
};
const zero = (arm) =>
  (arm === "b" ? base : head).filter((r) => r.count === 0).length;
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;

const latencies = head.map((r) => r.ms).sort((a, b) => a - b);
const baseLat = base.map((r) => r.ms).sort((a, b) => a - b);
const q = (a, p) =>
  a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(1);

console.log(
  JSON.stringify(
    {
      cases: base.length,
      casesWithExpectedConcept: withExpected.length,
      recallTop10: {
        before: `${recall(withExpected, "b")}/${withExpected.length} (${pct(recall(withExpected, "b"), withExpected.length)})`,
        after: `${recall(withExpected, "h")}/${withExpected.length} (${pct(recall(withExpected, "h"), withExpected.length)})`,
      },
      meanPositionAbsentScored11: {
        before: meanPos(withExpected, "b").toFixed(2),
        after: meanPos(withExpected, "h").toFixed(2),
      },
      zeroResultQueries: { before: zero("b"), after: zero("h") },
      latencyMs: {
        before: { p50: q(baseLat, 0.5), p95: q(baseLat, 0.95) },
        after: { p50: q(latencies, 0.5), p95: q(latencies, 0.95) },
      },
      identicalTop10: identical,
      singleWordControlViolations: singleWordViolations.length,
      orderPrefixViolations: prefixViolations.length,
    },
    null,
    2,
  ),
);
if (prefixViolations.length)
  console.log(
    "PREFIX VIOLATIONS",
    JSON.stringify(prefixViolations.slice(0, 5), null, 1),
  );
if (singleWordViolations.length)
  console.log(
    "SINGLE-WORD VIOLATIONS",
    JSON.stringify(singleWordViolations, null, 1),
  );

// Per-kind recall, so an improvement cannot hide behind one easy stratum.
const kinds = [...new Set(base.map((r) => r.kind))];
for (const kind of kinds) {
  const rows = withExpected.filter(({ b }) => b.kind === kind);
  if (!rows.length) {
    console.log(`${kind}: no expected concept`);
    continue;
  }
  console.log(
    `${kind.padEnd(12)} n=${String(rows.length).padStart(2)}  recall ${recall(rows, "b")} -> ${recall(rows, "h")}   mean pos ${meanPos(rows, "b").toFixed(2)} -> ${meanPos(rows, "h").toFixed(2)}`,
  );
}
