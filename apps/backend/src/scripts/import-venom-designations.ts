import fs from "node:fs";
import path from "node:path";
import { prisma } from "src/config/prisma";

/**
 * VeNom publishes 16,057 term labels in Spanish and Portuguese. None have been imported,
 * so the vocabulary is English-only: a Spanish-speaking practice sees English terms, and
 * an export offers a research consumer no way to read the concept in its own language.
 *
 * These are designations of an existing concept, not new concepts. A translation must
 * never become a separate term, or "Alopecia" and "Alopecia" (es-ES) would be two
 * different things a clinician could pick between.
 */
export type DesignationExtract = {
  source: string;
  release: string;
  released: string;
  /** [ycCode, term, culture, type] */
  designations: Array<[string, string, string, string]>;
};

export type Designation = {
  term: string;
  lang: string;
  source: string;
  preferred: boolean;
};

export type PlannedConcept = {
  ycCode: string;
  designations: Designation[];
  added: number;
};

export type DesignationPlan = {
  concepts: PlannedConcept[];
  skipped: Array<{ ycCode: string; term: string; reason: string }>;
};

const key = (term: string, lang: string) =>
  `${term.trim().toLowerCase()}|${lang.trim().toLowerCase()}`;

export const planDesignations = (
  extract: DesignationExtract,
  existing: Map<string, Designation[]>,
): DesignationPlan => {
  const merged = new Map<
    string,
    { current: Designation[]; seen: Set<string>; added: number }
  >();
  const skipped: DesignationPlan["skipped"] = [];

  // The fourth element is VeNom's label type. Whether a designation is a translation or
  // a synonym does not change how it is stored, so it is not destructured.
  for (const [ycCode, term, lang] of extract.designations) {
    const trimmed = term.trim();
    if (!trimmed || !lang.trim()) {
      skipped.push({ ycCode, term, reason: "empty term or language" });
      continue;
    }

    let entry = merged.get(ycCode);
    if (!entry) {
      const current = existing.get(ycCode);
      if (!current) {
        skipped.push({ ycCode, term, reason: "concept not found" });
        continue;
      }
      entry = {
        current: [...current],
        seen: new Set(current.map((d) => key(d.term, d.lang))),
        added: 0,
      };
      merged.set(ycCode, entry);
    }

    if (entry.seen.has(key(trimmed, lang))) {
      skipped.push({ ycCode, term, reason: "already present" });
      continue;
    }

    entry.seen.add(key(trimmed, lang));
    entry.current.push({
      term: trimmed,
      lang: lang.trim(),
      source: "venom",
      // Never preferred. The preferred designation is the concept's own label, and a
      // translation taking that slot would change which term the UI shows by default.
      preferred: false,
    });
    entry.added += 1;
  }

  return {
    concepts: [...merged.entries()]
      .filter(([, value]) => value.added > 0)
      .map(([ycCode, value]) => ({
        ycCode,
        designations: value.current,
        added: value.added,
      })),
    skipped,
  };
};

export const loadDesignations = (filePath: string): DesignationExtract => {
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("Invalid file path");
  }
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
};

const asDesignations = (value: unknown): Designation[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Designation =>
      !!item &&
      typeof item === "object" &&
      typeof (item as Designation).term === "string" &&
      typeof (item as Designation).lang === "string",
  );
};

export const loadExistingDesignations = async () => {
  const entries = await prisma.codeEntry.findMany({
    where: { system: "YOSEMITECODE", type: "CLINICAL_TERM", active: true },
    select: { code: true, meta: true },
  });
  const index = new Map<string, Designation[]>();
  for (const entry of entries) {
    const meta = entry.meta as { designations?: unknown } | null;
    index.set(entry.code, asDesignations(meta?.designations));
  }
  return index;
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const extract = loadDesignations("data/venom_designations.json");
  const existing = await loadExistingDesignations();
  const plan = planDesignations(extract, existing);

  const reasons = new Map<string, number>();
  for (const item of plan.skipped) {
    reasons.set(item.reason, (reasons.get(item.reason) ?? 0) + 1);
  }
  const added = plan.concepts.reduce(
    (total, concept) => total + concept.added,
    0,
  );

  console.log(`VeNom release ${extract.release} (${extract.released})`);
  console.log(`  designations in file: ${extract.designations.length}`);
  console.log(`  concepts to update:   ${plan.concepts.length}`);
  console.log(`  designations to add:  ${added}`);
  console.log(`  skipped:              ${plan.skipped.length}`);
  for (const [reason, count] of [...reasons.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`    ${count}  ${reason}`);
  }

  if (!apply) {
    console.log("dry run - pass --apply to write");
    return;
  }

  // One transaction: a half-translated vocabulary is worse than an untranslated one,
  // because it looks finished.
  await prisma.$transaction(
    plan.concepts.map(
      (concept) =>
        prisma.$executeRaw`
        UPDATE "CodeEntry"
        SET "meta" = jsonb_set(
              COALESCE("meta", '{}'::jsonb),
              '{designations}',
              ${JSON.stringify(concept.designations)}::jsonb
            ),
            "updatedAt" = NOW()
        WHERE "system" = 'YOSEMITECODE'::"CodeSystem" AND "code" = ${concept.ycCode}
      `,
    ),
  );

  console.log(
    `wrote ${added} designations across ${plan.concepts.length} concepts`,
  );
};

// argv[1] rather than require.main, which is not defined under ESM.
const invokedDirectly = (process.argv[1] ?? "").includes(
  "import-venom-designations",
);

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
