/**
 * Backfill `speciesCode` and `breedCode` on Patient rows that have neither.
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

export const planBackfill = async (): Promise<Outcome[]> => {
  const patients = await prisma.patient.findMany({
    where: { breedCode: null },
    select: { id: true, breed: true, type: true },
  });

  const outcomes: Outcome[] = [];

  for (const patient of patients) {
    const breed = patient.breed?.trim();
    const species = SPECIES_BY_TYPE[patient.type];

    if (!breed) {
      outcomes.push({
        patientId: patient.id,
        breed: patient.breed ?? "",
        type: patient.type,
        resolved: null,
        reason: "no breed text to match",
      });
      continue;
    }

    if (!species) {
      // `other`, or a species the breed vocabulary does not cover.
      outcomes.push({
        patientId: patient.id,
        breed,
        type: patient.type,
        resolved: null,
        reason: `species '${patient.type}' has no breed vocabulary`,
      });
      continue;
    }

    const candidates = await prisma.codeEntry.findMany({
      where: {
        code: { startsWith: species.prefix },
        display: { equals: breed, mode: "insensitive" },
      },
      select: { code: true },
    });

    const distinct = [
      ...new Set(
        candidates
          .map((entry) => canonicalBreedCode(entry.code))
          .filter((code): code is string => Boolean(code)),
      ),
    ];

    if (distinct.length === 1) {
      outcomes.push({
        patientId: patient.id,
        breed,
        type: patient.type,
        resolved: distinct[0],
        reason: "matched within its own species",
      });
    } else if (distinct.length === 0) {
      outcomes.push({
        patientId: patient.id,
        breed,
        type: patient.type,
        resolved: null,
        reason: "no vocabulary entry for this breed in this species",
      });
    } else {
      outcomes.push({
        patientId: patient.id,
        breed,
        type: patient.type,
        resolved: null,
        reason: `ambiguous: ${distinct.join(", ")}`,
      });
    }
  }

  return outcomes;
};

const main = async () => {
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
  for (const outcome of resolved) {
    const species = SPECIES_BY_TYPE[outcome.type];
    await prisma.patient.update({
      where: { id: outcome.patientId },
      data: { speciesCode: species.code, breedCode: outcome.resolved },
    });
    written += 1;
  }
  console.log(`\nwrote ${written} companions`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
