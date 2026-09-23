// Compares two measure.ts runs over the crowded-page sample.
//
// There is no ground truth for what a clinician typing "renal" intends, so this report
// does not invent one. It reports what the two pages are, plus one descriptive figure
// for the complaint in the issue: how much of the first page one label family occupies.
//
// A family is a label's first two words. That is deliberately coarse - it treats
// "Renal (kidney) cyst" and "Renal (kidney) disorder" as one family - and it is applied
// identically to both arms. It is descriptive, not a proof: a tiebreak that prefers
// shorter labels will tend to spread first-two-word families apart, so the figure
// describes the change rather than justifying it. The pages themselves are printed in
// full so a reviewer can disagree.
import fs from "node:fs";

const [basePath, headPath] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(basePath, "utf8")).results;
const head = JSON.parse(fs.readFileSync(headPath, "utf8")).results;

const words = (s) => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const family = (label) => words(label).slice(0, 2).join(" ").toLowerCase();

const pageStats = (row) => {
  const families = row.top10.map((t) => family(t.label));
  const counts = new Map();
  for (const f of families) counts.set(f, (counts.get(f) ?? 0) + 1);
  return {
    n: row.top10.length,
    distinct: counts.size,
    largest: Math.max(0, ...counts.values()),
  };
};

const mean = (values) => values.reduce((a, v) => a + v, 0) / values.length;
const lines = [];
let unchanged = 0;
const perQuery = [];

for (let i = 0; i < base.length; i += 1) {
  const b = base[i];
  const h = head[i];
  if (b.query !== h.query) throw new Error(`sample order differs at ${i}`);
  const bs = pageStats(b);
  const hs = pageStats(h);
  const same =
    JSON.stringify(b.top10.map((t) => t.ycCode)) ===
    JSON.stringify(h.top10.map((t) => t.ycCode));
  if (same) unchanged += 1;
  perQuery.push({ query: b.query, bs, hs, same, b, h });
}

lines.push(`queries: ${base.length}`);
lines.push(`first page unchanged: ${unchanged}`);
lines.push(
  `mean distinct label families on the first page: ${mean(
    perQuery.map((r) => r.bs.distinct),
  ).toFixed(2)} -> ${mean(perQuery.map((r) => r.hs.distinct)).toFixed(2)}`,
);
lines.push(
  `mean size of the largest family on the first page: ${mean(
    perQuery.map((r) => r.bs.largest),
  ).toFixed(2)} -> ${mean(perQuery.map((r) => r.hs.largest)).toFixed(2)}`,
);
lines.push(
  `queries whose first page is one family more than half over: ${
    perQuery.filter((r) => r.bs.largest * 2 > r.bs.n).length
  } -> ${perQuery.filter((r) => r.hs.largest * 2 > r.hs.n).length}`,
);
lines.push(
  `queries where the largest family grew: ${
    perQuery.filter((r) => r.hs.largest > r.bs.largest).length
  }`,
);

lines.push("");
lines.push(
  "| query | matches | families before | families after | largest before | largest after |",
);
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const r of perQuery) {
  lines.push(
    `| \`${r.query}\` | ${r.b.count} | ${r.bs.distinct} | ${r.hs.distinct} | ${r.bs.largest} | ${r.hs.largest} |`,
  );
}

lines.push("");
for (const r of perQuery) {
  lines.push(`### \`${r.query}\`${r.same ? " (unchanged)" : ""}`);
  lines.push("");
  lines.push("| # | before | after |");
  lines.push("| --- | --- | --- |");
  for (let i = 0; i < Math.max(r.b.top10.length, r.h.top10.length); i += 1) {
    lines.push(
      `| ${i + 1} | ${r.b.top10[i]?.label ?? ""} | ${r.h.top10[i]?.label ?? ""} |`,
    );
  }
  lines.push("");
}

console.log(lines.join("\n"));
