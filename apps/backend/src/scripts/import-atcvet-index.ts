import fs from "node:fs";
import path from "node:path";
import { prisma } from "src/config/prisma";

/**
 * Imports the WHO CC ATCvet index as the medication spine: every code becomes a
 * CodeEntry under the ATCVET system, and the classification's five levels become
 * CodeRelationship "is a" edges, exactly as the VeNom hierarchy import does for
 * clinical terms.
 *
 * The index is copyright the WHO Collaborating Centre for Drug Statistics
 * Methodology and is included under a licence granted for use within Yosemite
 * Crew - see the third-party data notice in License.txt. It is not sublicensed to
 * users of this repository, who need their own licence to use ATCvet data.
 *
 * Regenerate data/atcvet_index.json from a new yearly release with
 * scripts/convert-atcvet-xlsx.mjs, or point elsewhere via ATCVET_INDEX_PATH.
 * Paths are relative to the backend working directory.
 */
export type AtcvetExtract = {
  source: string;
  dataset: string;
  release: string;
  entries: Array<{ code: string; name: string }>;
};

export type PlannedEntry = {
  code: string;
  display: string;
  type: "MEDICATION" | "MEDICATION_CATEGORY";
  level: number;
  parent: string | null;
  species: string[];
};

export type SkippedEntry = { code: string; reason: string };

export type ImportPlan = {
  entries: PlannedEntry[];
  edges: Array<{ sourceCode: string; targetCode: string }>;
  skipped: SkippedEntry[];
};

/**
 * ATCvet codes carry their own hierarchy in their length: Q + letter (anatomical
 * main group), + 2 digits (therapeutic), + letter (pharmacological), + letter
 * (chemical subgroup), + 2 digits (substance). A code's parent is therefore the
 * prefix one level up - no separate parent table is published, and none is needed.
 */
const LEVEL_BY_LENGTH: Record<number, number> = {
  2: 1,
  4: 2,
  5: 3,
  6: 4,
  8: 5,
};
const PARENT_LENGTH: Record<number, number> = { 4: 2, 5: 4, 6: 5, 8: 6 };

/** The grammar the whole file obeys; anything else is a malformed row, not a code. */
const CODE_PATTERN = /^Q[A-Z](\d{2}([A-Z]([A-Z](\d{2})?)?)?)?$/;

/**
 * QI is the one group whose second level encodes a species rather than a
 * therapeutic class ("QI07 IMMUNOLOGICALS FOR CANIDAE"), so vaccine codes carry
 * species meaning the other fourteen groups do not. Mapping it onto our own
 * species buckets is what lets a cat clinic's vaccine search exclude porcine
 * immunologicals. Groups are mapped only where the zoological family maps cleanly;
 * QI20 ("other species") is deliberately left unmapped rather than guessed at.
 */
const QI_SPECIES: Record<string, string[]> = {
  QI01: ["AVIAN"],
  QI02: ["FARM"],
  QI03: ["FARM"],
  QI04: ["FARM"],
  QI05: ["EQUINE"],
  QI06: ["SA"],
  QI07: ["SA"],
  QI08: ["EXOTICS"],
  QI09: ["FARM"],
  QI10: ["EXOTICS"],
  QI11: ["EXOTICS"],
};

export const parentOf = (code: string): string | null => {
  const parentLength = PARENT_LENGTH[code.length];
  return parentLength ? code.slice(0, parentLength) : null;
};

/**
 * Species inherited from the QI second level, for immunologicals only. Every key
 * in QI_SPECIES is QI-prefixed, so the lookup alone confines this to QI codes -
 * no separate group check can change the answer.
 */
export const speciesFor = (code: string): string[] =>
  QI_SPECIES[code.slice(0, 4)] ?? [];

export const planImport = (extract: AtcvetExtract): ImportPlan => {
  const entries: PlannedEntry[] = [];
  const skipped: SkippedEntry[] = [];
  const seen = new Set<string>();

  for (const entry of extract.entries) {
    const code = entry.code.trim();
    const display = entry.name.trim();
    if (!code || !display) {
      skipped.push({ code: code || "(blank)", reason: "missing code or name" });
      continue;
    }
    if (!CODE_PATTERN.test(code) || !LEVEL_BY_LENGTH[code.length]) {
      skipped.push({ code, reason: "not a valid ATCvet code" });
      continue;
    }
    if (seen.has(code)) {
      skipped.push({ code, reason: "duplicate code in extract" });
      continue;
    }
    seen.add(code);
    const level = LEVEL_BY_LENGTH[code.length];
    entries.push({
      code,
      display,
      // Only the substance level is prescribable; the four above it are headings.
      type: level === 5 ? "MEDICATION" : "MEDICATION_CATEGORY",
      level,
      parent: parentOf(code),
      species: speciesFor(code),
    });
  }

  // An edge is only planned when its parent is present in the same extract, so a
  // partial file produces a smaller graph rather than edges pointing at nothing.
  const edges: ImportPlan["edges"] = [];
  for (const entry of entries) {
    if (!entry.parent) continue;
    if (!seen.has(entry.parent)) {
      skipped.push({
        code: entry.code,
        reason: `parent ${entry.parent} not in extract`,
      });
      continue;
    }
    edges.push({ sourceCode: entry.code, targetCode: entry.parent });
  }

  return { entries, edges, skipped };
};

/**
 * Repo-relative paths only, as in the VeNom importers: the script reads whatever
 * it is pointed at, so it should not be pointed outside the working tree.
 * Checked before any filesystem call, so a rejected path is not even probed for
 * existence.
 */
const assertReadablePath = (filePath: string): void => {
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("Invalid file path");
  }
};

const readExtract = (filePath: string): AtcvetExtract =>
  JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));

export const main = async () => {
  const filePath =
    process.argv.find((arg) => arg.endsWith(".json")) ??
    process.env.ATCVET_INDEX_PATH ??
    "data/atcvet_index.json";
  const apply = process.argv.includes("--apply");
  assertReadablePath(filePath);

  if (!fs.existsSync(path.resolve(filePath))) {
    console.log(
      `ATCvet index not found at ${filePath}. It is licensed and deliberately not committed; convert your own copy with scripts/convert-atcvet-xlsx.mjs or set ATCVET_INDEX_PATH.`,
    );
    return;
  }

  const extract = readExtract(filePath);
  const plan = planImport(extract);

  console.log(
    `ATCvet ${extract.release}: ${plan.entries.length} codes (${plan.entries.filter((e) => e.type === "MEDICATION").length} substances, ${plan.entries.filter((e) => e.type === "MEDICATION_CATEGORY").length} groups), ${plan.edges.length} edges`,
  );
  for (const skip of plan.skipped) {
    console.log(`  SKIP ${skip.code}: ${skip.reason}`);
  }

  if (!apply) {
    console.log("dry run - pass --apply to write");
    return;
  }

  // Provenance travels with every row so a later release can be told apart from
  // this one without consulting a changelog.
  const meta = (entry: PlannedEntry) => ({
    level: entry.level,
    atcGroup: entry.code.slice(0, 2),
    ...(entry.species.length > 0 ? { species: entry.species } : {}),
    // QJ01 is "antibacterials for systemic use" - the group antimicrobial
    // stewardship reporting is actually about. Recorded as a fact of the
    // classification, not a clinical judgement layered on top of it.
    ...(entry.code.startsWith("QJ01") ? { antibacterial: true } : {}),
    source: extract.source,
    dataset: extract.dataset,
    release: extract.release,
  });

  let written = 0;
  const BATCH = 500;
  for (let index = 0; index < plan.entries.length; index += BATCH) {
    const batch = plan.entries.slice(index, index + BATCH);
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.codeEntry.upsert({
          where: { system_code: { system: "ATCVET", code: entry.code } },
          // Re-running a release refreshes the display and provenance rather than
          // duplicating rows: the import is idempotent by design.
          update: {
            display: entry.display,
            type: entry.type,
            active: true,
            meta: meta(entry),
          },
          create: {
            system: "ATCVET",
            code: entry.code,
            display: entry.display,
            type: entry.type,
            active: true,
            meta: meta(entry),
          },
        }),
      ),
    );
    written += batch.length;
  }

  const edgeResult = await prisma.codeRelationship.createMany({
    data: plan.edges.map((edge) => ({
      system: "ATCVET" as const,
      sourceCode: edge.sourceCode,
      type: "is a",
      targetCode: edge.targetCode,
    })),
    skipDuplicates: true,
  });

  console.log(
    `upserted ${written} codes and added ${edgeResult.count} edges (${plan.edges.length - edgeResult.count} already present)`,
  );
};

// Only run when invoked directly, so importing the planner in tests does not
// start a database session.
if (process.argv[1] && process.argv[1].endsWith("import-atcvet-index.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
