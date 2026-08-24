/**
 * Backfill `speciesCode` and `breedCode` on Patient rows with no breed code.
 *
 * Selected on `breedCode` alone, not on both columns being null. The two are
 * written together here, but a row with a species and no breed is exactly a row
 * that needs repairing - requiring both to be null would skip it.
 *
 * Recommendation rules match on coded species and breed. On production today
 * only 7 of 37 companions are coded - about 19 percent - so a matcher built on
 * those columns would work for one companion in five. All 37 have breed text,
 * and because the values come from a picker rather than a keyboard they match
 * `CodeEntry.display` exactly, so the gap is closable without fuzzy matching.
 *
 * Two traps, both found in the data rather than imagined:
 *
 *   Same display, different species. `Abyssinian` is a cat breed AND a horse
 *   breed; `Maltese` is a dog AND a cat. Matching on display alone would have
 *   coded an Abyssinian cat as a horse and then handed it equine guidance. Every
 *   lookup is therefore scoped by `Patient.type` first, which is required and
 *   already correct.
 *
 *   Same breed, two spellings. The vocabulary holds 36 breeds under both
 *   separator conventions (`SHIH_TZU` and `SHIH-TZU`). Candidates are compared
 *   canonically so those collapse to one answer instead of reading as a conflict.
 *
 * Anything still ambiguous after both is SKIPPED and reported. A wrong code is
 * worse than a missing one: a missing code shows no recommendations, a wrong one
 * shows confident recommendations for the wrong animal.
 *
 * Dry run by default. Pass --apply to write:
 *
 *   pnpm --filter backend exec tsx src/scripts/backfill-breed-codes.ts
 *   pnpm --filter backend exec tsx src/scripts/backfill-breed-codes.ts --apply
 */
import { prisma } from "src/config/prisma";
import { canonicalBreedCode } from "src/services/shared/breed-code";

const SPECIES_BY_TYPE: Record<string, { code: string; prefix: string }> = {
  dog: { code: "YSPEC:CANINE", prefix: "YBREED:CANINE:" },
  cat: { code: "YSPEC:FELINE", prefix: "YBREED:FELINE:" },
  horse: { code: "YSPEC:EQUINE", prefix: "YBREED:EQUINE:" },
};

interface Outcome {
  patientId: string;
  breed: string;
  type: string;
  resolved: string | null;
  reason: string;
}

/** Key for the per-species vocabulary map. Display is matched case-insensitively. */
const vocabKey = (type: string, display: string) =>
  `${type}::${display.trim().toLowerCase()}`;

/**
 * Every breed display this run needs, per species, resolved in one query each.
 *
 * One query per species rather than per companion: each lookup asks the same
 * species-scoped question, so a round trip per row bought no new information.
 */
const loadVocabulary = async (
  patients: Array<{ breed: string; type: string }>,
): Promise<Map<string, string[]>> => {
  const wanted = new Map<string, Set<string>>();
  for (const patient of patients) {
    const breed = patient.breed?.trim();
    if (!breed || !SPECIES_BY_TYPE[patient.type]) continue;
    const set = wanted.get(patient.type) ?? new Set<string>();
    set.add(breed);
    wanted.set(patient.type, set);
  }

  const vocabulary = new Map<string, string[]>();
  for (const [type, breeds] of wanted) {
    const species = SPECIES_BY_TYPE[type];
    const entries = await prisma.codeEntry.findMany({
      where: {
        // Constrained to the live Yosemite breed vocabulary. Without
        // system/type/active, an inactive entry - or one from another code
        // system carrying a YBREED-shaped code and the same display - would be
        // accepted, and the apply phase would persist a code that ordinary
        // companion writes would never produce.
        system: "YOSEMITECODE",
        type: "BREED",
        active: true,
        code: { startsWith: species.prefix },
        display: { in: [...breeds], mode: "insensitive" },
      },
      select: { code: true, display: true },
    });
    for (const entry of entries) {
      const key = vocabKey(type, entry.display ?? "");
      vocabulary.set(key, [...(vocabulary.get(key) ?? []), entry.code]);
    }
  }
  return vocabulary;
};

/** What this run would do to one companion, and why. */
const classify = (
  patient: { id: string; breed: string; type: string },
  vocabulary: Map<string, string[]>,
): Outcome => {
  const breed = patient.breed?.trim();
  const base = {
    patientId: patient.id,
    breed: breed ?? "",
    type: patient.type,
  };

  if (!breed) {
    return { ...base, resolved: null, reason: "no breed text to match" };
  }
  if (!SPECIES_BY_TYPE[patient.type]) {
    // `other`, or a species the breed vocabulary does not cover.
    return {
      ...base,
      resolved: null,
      reason: `species '${patient.type}' has no breed vocabulary`,
    };
  }

  const distinct = [
    ...new Set(
      (vocabulary.get(vocabKey(patient.type, breed)) ?? [])
        .map((code) => canonicalBreedCode(code))
        .filter((code): code is string => Boolean(code)),
    ),
  ];

  if (distinct.length === 1) {
    return {
      ...base,
      resolved: distinct[0],
      reason: "matched within its own species",
    };
  }
  if (distinct.length === 0) {
    return {
      ...base,
      resolved: null,
      reason: "no vocabulary entry for this breed in this species",
    };
  }
  return {
    ...base,
    resolved: null,
    reason: `ambiguous: ${distinct.join(", ")}`,
  };
};

export const planBackfill = async (): Promise<Outcome[]> => {
  const patients = await prisma.patient.findMany({
    where: { breedCode: null },
    select: { id: true, breed: true, type: true },
  });

  const vocabulary = await loadVocabulary(patients);
  return patients.map((patient) => classify(patient, vocabulary));
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const outcomes = await planBackfill();

  const resolved = outcomes.filter((o) => o.resolved);
  const skipped = outcomes.filter((o) => !o.resolved);

  console.log(`${outcomes.length} companions without a breed code`);
  console.log(`  ${resolved.length} resolvable`);
  console.log(`  ${skipped.length} skipped`);

  for (const outcome of skipped) {
    console.log(
      `  SKIP ${outcome.type} "${outcome.breed}" - ${outcome.reason}`,
    );
  }

  if (!apply) {
    console.log("\ndry run; pass --apply to write");
    return;
  }

  let written = 0;
  let skippedConcurrent = 0;
  for (const outcome of resolved) {
    const species = SPECIES_BY_TYPE[outcome.type];
    // Conditional on breedCode still being null, via updateMany rather than
    // update. A parent editing their companion between the plan and this loop
    // would otherwise have their newly chosen breed overwritten by a value
    // planned from the row as it was before they touched it.
    const result = await prisma.patient.updateMany({
      where: { id: outcome.patientId, breedCode: null },
      data: { speciesCode: species.code, breedCode: outcome.resolved },
    });
    if (result.count === 0) {
      skippedConcurrent += 1;
      continue;
    }
    written += 1;
  }
  console.log(`\nwrote ${written} companions`);
  if (skippedConcurrent > 0) {
    console.log(
      `  ${skippedConcurrent} skipped - coded by someone else while this ran`,
    );
  }
};

/**
 * Only run when this file IS the command, not when a test imports planBackfill.
 *
 * Unguarded, importing this module started main() before any test had mocked a
 * result, so planBackfill threw and the catch set process.exitCode = 1. The suite
 * reported 8 passing tests and jest still exited 1 - a red build with nothing red
 * in the output to explain it.
 *
 * argv[1] rather than require.main, which is not defined under ESM.
 */
const invokedDirectly = (process.argv[1] ?? "").includes(
  "backfill-breed-codes",
);

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
