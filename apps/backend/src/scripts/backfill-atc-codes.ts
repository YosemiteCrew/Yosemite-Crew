import { prisma } from "src/config/prisma";

/**
 * Matches a practice's own drug list and medicine stock to ATCvet substances.
 *
 * Deliberately conservative, for two reasons found in the data:
 *
 *  - One substance name maps to SEVERAL ATCvet codes, because the classification
 *    separates therapeutic uses. Doxycycline is QA01AB22 orally in the mouth and
 *    QJ01AA02 systemically; ibuprofen holds three codes. Picking the first would
 *    file a drug under a therapeutic class it does not belong to, which is worse
 *    than leaving it uncoded - the wrong class is what stewardship reporting and
 *    interaction checks would then read.
 *  - ATCvet uses INN spellings. "Cephalexin" as typed by a practice matches
 *    nothing; the substance is "cefalexin". Rather than fuzzy-matching drug names
 *    (where a near miss is a different medicine), unmatched rows are reported so a
 *    human can decide.
 *
 * Only exact, unambiguous, normalised matches are written.
 */
export type Candidate = {
  id: string;
  name: string;
  genericName: string | null;
};

export type Outcome = {
  id: string;
  name: string;
  matchedOn: string | null;
  resolved: string | null;
  reason?: string;
};

/**
 * Compare on letters and digits only, so "Cefalexin 250 mg Tablet" and
 * "cefalexin" differ only by the trailing strength - which is why the strength is
 * stripped separately below rather than being folded in here.
 */
export const normalise = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Strips a trailing dose/pack description so "cefalexin 250 mg tablet" can match
 * the substance "cefalexin". Only a trailing run is removed: a leading number is
 * part of a name (as in "5 fluorouracil") and must survive.
 */
export const stripPresentation = (value: string): string =>
  normalise(value)
    // `normalise` has already turned "1%" into "1", so the unit must be optional
    // here: with it required, "Hydrocortisone 1% cream" kept "1 cream" and
    // matched no substance.
    .replace(/\s+\d+(\s*\.\d+)?(\s*(mg|g|ml|mcg|iu|kg))?\b.*$/, "")
    .replace(
      /\s+(tablet|tablets|capsule|capsules|injection|suspension|solution|cream|ointment|drops|pack|spray|powder|paste)s?\b.*$/,
      "",
    )
    .trim();

/**
 * Inventory categories ATCvet can classify. Matched as substrings so a practice's
 * "Medicines" or "Vaccines (canine)" is covered without an exact-name list.
 */
export const CODEABLE_CATEGORIES = ["medic", "vaccin", "drug", "pharma"];

export const planBackfill = async (): Promise<{
  formulary: Outcome[];
  inventory: Outcome[];
}> => {
  // Every ATCvet substance, keyed by normalised display. A name held by more than
  // one code is kept as a list so ambiguity is visible rather than collapsed.
  const substances = await prisma.codeEntry.findMany({
    where: { system: "ATCVET", type: "MEDICATION", active: true },
    select: { code: true, display: true },
  });
  const byName = new Map<string, string[]>();
  for (const substance of substances) {
    const key = normalise(substance.display);
    byName.set(key, [...(byName.get(key) ?? []), substance.code]);
  }

  const resolve = (candidate: Candidate): Outcome => {
    // The generic name is the better key when present: a practice's product name
    // carries brands and strengths, the generic is closer to the substance.
    const attempts: Array<{ field: string; value: string }> = [];
    if (candidate.genericName?.trim()) {
      attempts.push({ field: "genericName", value: candidate.genericName });
    }
    attempts.push({ field: "name", value: candidate.name });

    for (const attempt of attempts) {
      for (const key of [
        normalise(attempt.value),
        stripPresentation(attempt.value),
      ]) {
        if (!key) continue;
        const codes = byName.get(key);
        if (!codes) continue;
        if (codes.length > 1) {
          return {
            id: candidate.id,
            name: candidate.name,
            matchedOn: attempt.field,
            resolved: null,
            reason: `ambiguous: ${codes.join(", ")}`,
          };
        }
        return {
          id: candidate.id,
          name: candidate.name,
          matchedOn: attempt.field,
          resolved: codes[0],
        };
      }
    }

    return {
      id: candidate.id,
      name: candidate.name,
      matchedOn: null,
      resolved: null,
      reason: "no ATCvet substance with this name",
    };
  };

  const formularyRows = await prisma.drugFormulary.findMany({
    where: { atcCode: null },
    select: { id: true, drugName: true, genericName: true },
  });
  const inventoryRows = await prisma.inventoryItem.findMany({
    // Stock that ATCvet can classify. Vaccines matter as much as drugs here -
    // they are the QI codes, the only ones carrying species - and "Vaccine" is
    // its own inventory category, so matching on "medic" alone silently skipped
    // every one of them. Non-clinical stock (leads, shampoo) still has no code.
    where: {
      atcCode: null,
      OR: CODEABLE_CATEGORIES.map((category) => ({
        category: { contains: category, mode: "insensitive" as const },
      })),
    },
    select: { id: true, name: true, genericName: true },
  });

  return {
    formulary: formularyRows.map((row) =>
      resolve({ id: row.id, name: row.drugName, genericName: row.genericName }),
    ),
    inventory: inventoryRows.map((row) =>
      resolve({ id: row.id, name: row.name, genericName: row.genericName }),
    ),
  };
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const { formulary, inventory } = await planBackfill();

  const report = (label: string, outcomes: Outcome[]) => {
    const matched = outcomes.filter((o) => o.resolved);
    console.log(
      `${label}: ${outcomes.length} uncoded, ${matched.length} matched`,
    );
    for (const outcome of outcomes.filter((o) => !o.resolved)) {
      console.log(`  SKIP "${outcome.name}": ${outcome.reason}`);
    }
    return matched;
  };

  const formularyMatched = report("formulary", formulary);
  const inventoryMatched = report("inventory", inventory);

  if (!apply) {
    console.log("dry run - pass --apply to write");
    return;
  }

  let written = 0;
  for (const outcome of formularyMatched) {
    // Still-null in the where clause: someone coding the row by hand between the
    // plan and the write keeps their value rather than losing it to a stale plan.
    const result = await prisma.drugFormulary.updateMany({
      where: { id: outcome.id, atcCode: null },
      data: { atcCode: outcome.resolved },
    });
    written += result.count;
  }
  for (const outcome of inventoryMatched) {
    const result = await prisma.inventoryItem.updateMany({
      where: { id: outcome.id, atcCode: null },
      data: { atcCode: outcome.resolved },
    });
    written += result.count;
  }

  const planned = formularyMatched.length + inventoryMatched.length;
  console.log(
    `wrote ${written} rows${written < planned ? ` (${planned - written} coded by someone else meanwhile)` : ""}`,
  );
};

if (process.argv[1] && process.argv[1].endsWith("backfill-atc-codes.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
