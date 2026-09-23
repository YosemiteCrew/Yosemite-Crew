import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { ClinicalTermsService } from "src/services/clinical-terms.service";
import { prisma } from "src/config/prisma";

type Case = {
  kind: string;
  query: string;
  expected: string | null;
  note: string;
};

const [fixturePath, outPath] = process.argv.slice(2);
const cases: Case[] = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

const main = async () => {
  const seeded = await prisma.codeEntry.count({
    where: { system: "YOSEMITECODE", type: "CLINICAL_TERM", active: true },
  });
  const results = [];
  for (const testCase of cases) {
    // Warm, then time, so the figure is the query rather than the first-call overhead.
    await ClinicalTermsService.suggestTerms({ q: testCase.query, limit: 10 });
    const started = performance.now();
    const page = await ClinicalTermsService.suggestTerms({
      q: testCase.query,
      limit: 10,
    });
    const ms = performance.now() - started;
    const codes = page.map((suggestion) => suggestion.ycCode);
    results.push({
      ...testCase,
      ms,
      count: page.length,
      // label, not display: toSuggestion renames the column on the way out.
      top10: page.map((suggestion) => ({
        ycCode: suggestion.ycCode,
        label: suggestion.label,
      })),
      expectedPosition: testCase.expected
        ? codes.indexOf(testCase.expected) + 1
        : null,
    });
  }
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ seeded, results }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ seeded, cases: results.length, out: outPath }));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
