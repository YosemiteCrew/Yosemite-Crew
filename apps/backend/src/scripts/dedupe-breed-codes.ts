/**
 * Collapse the breed vocabulary's two-spellings-per-breed duplicates onto one code.
 *
 * `CodeEntry` holds the same breed under both separator conventions for 36
 * breeds - `YBREED:CANINE:SHIH_TZU` and `YBREED:CANINE:SHIH-TZU` are two rows
 * for one breed, and the seven already-coded companions in production are
 * split across both. Anything that joins on `breedCode` literally - reporting,
 * PIMS filters, IDEXX reference ranges, an export - silently misses whichever
 * half of the population is coded the other way (#2450).
 *
 * Underscore wins. `buildBreedCode` in idexx-reference.service.ts, the only
 * live writer of new breed codes, has always emitted underscores; keeping
 * hyphen as canonical would leave that generator producing a "new" duplicate
 * against it forever.
 *
 * A loser is DEACTIVATED, never deleted - the rest of the codebase already
 * treats `active: false` as invisible (every vocabulary query filters on it,
 * same as `backfill-breed-codes.ts`), so this reaches "one code per breed"
 * without destroying the audit trail of where the row came from.
 *
 * Dry run by default. Pass --apply to write:
 *
 *   pnpm --filter backend exec tsx src/scripts/dedupe-breed-codes.ts
 *   pnpm --filter backend exec tsx src/scripts/dedupe-breed-codes.ts --apply
 */
import { prisma } from "src/config/prisma";
import { canonicalBreedCode } from "src/services/shared/breed-code";

export interface DedupeGroup {
  canonical: string;
  winner: string;
  losers: string[];
}

export interface UnresolvedGroup {
  canonical: string;
  codes: string[];
  reason: string;
}

export interface DedupePlan {
  groups: DedupeGroup[];
  unresolved: UnresolvedGroup[];
}

/**
 * Group every breed code by its canonical form and split each group into a
 * winner - the one spelling that already equals its own canonical form - and
 * the rest. A group where zero or more than one code already matches the
 * canonical form is reported unresolved rather than guessed at: a wrong
 * repoint is worse than a duplicate left in place.
 */
export const planDedupe = async (): Promise<DedupePlan> => {
  const entries = await prisma.codeEntry.findMany({
    where: { system: "YOSEMITECODE", type: "BREED" },
    select: { code: true },
  });

  const byCanonical = new Map<string, string[]>();
  for (const entry of entries) {
    const canonical = canonicalBreedCode(entry.code);
    if (!canonical) continue;
    const codes = byCanonical.get(canonical) ?? [];
    codes.push(entry.code);
    byCanonical.set(canonical, codes);
  }

  const groups: DedupeGroup[] = [];
  const unresolved: UnresolvedGroup[] = [];

  for (const [canonical, codes] of byCanonical) {
    if (codes.length < 2) continue;

    const winners = codes.filter((code) => code === canonical);
    if (winners.length !== 1) {
      unresolved.push({
        canonical,
        codes,
        reason:
          winners.length === 0
            ? "no code already matches the canonical form"
            : "more than one code already matches the canonical form",
      });
      continue;
    }

    const winner = winners[0];
    groups.push({
      canonical,
      winner,
      losers: codes.filter((code) => code !== winner),
    });
  }

  return { groups, unresolved };
};

export const main = async () => {
  const apply = process.argv.includes("--apply");
  const { groups, unresolved } = await planDedupe();

  console.log(`${groups.length} duplicate breed pairs found`);
  for (const group of groups) {
    console.log(`  ${group.losers.join(", ")} -> ${group.winner}`);
  }
  if (unresolved.length > 0) {
    console.log(`${unresolved.length} unresolved groups`);
    for (const group of unresolved) {
      console.log(
        `  SKIP ${group.canonical} - ${group.reason}: ${group.codes.join(", ")}`,
      );
    }
  }

  if (!apply) {
    console.log("\ndry run; pass --apply to write");
    return;
  }

  let patientsRepointed = 0;
  let mappingsRepointed = 0;
  let mappingsDeduped = 0;
  let entriesDeactivated = 0;

  const mappingKey = (targetSystem: string, targetCode: string) =>
    `${targetSystem}:${targetCode}`;

  for (const group of groups) {
    // Fetched once per group rather than once per loser mapping (an N+1
    // read otherwise) and kept up to date as losers are repointed, so a
    // second loser mapping to the same target is deduped instead of
    // colliding with the unique (sourceSystem, sourceCode, targetSystem,
    // targetCode) constraint the first repoint would already have claimed.
    const winnerMappings = await prisma.codeMapping.findMany({
      where: { sourceSystem: "YOSEMITECODE", sourceCode: group.winner },
      select: { targetSystem: true, targetCode: true },
    });
    const winnerTargets = new Set(
      winnerMappings.map((m) => mappingKey(m.targetSystem, m.targetCode)),
    );

    for (const loser of group.losers) {
      const patientResult = await prisma.patient.updateMany({
        where: { breedCode: loser },
        data: { breedCode: group.winner },
      });
      patientsRepointed += patientResult.count;

      const loserMappings = await prisma.codeMapping.findMany({
        where: { sourceSystem: "YOSEMITECODE", sourceCode: loser },
      });
      for (const mapping of loserMappings) {
        const key = mappingKey(mapping.targetSystem, mapping.targetCode);
        if (winnerTargets.has(key)) {
          await prisma.codeMapping.delete({ where: { id: mapping.id } });
          mappingsDeduped += 1;
        } else {
          await prisma.codeMapping.update({
            where: { id: mapping.id },
            data: { sourceCode: group.winner },
          });
          mappingsRepointed += 1;
          winnerTargets.add(key);
        }
      }

      await prisma.codeEntry.update({
        where: { system_code: { system: "YOSEMITECODE", code: loser } },
        data: { active: false },
      });
      entriesDeactivated += 1;
    }
  }

  console.log(
    `\nwrote: ${patientsRepointed} patients repointed, ${mappingsRepointed} mappings repointed, ` +
      `${mappingsDeduped} duplicate mappings removed, ${entriesDeactivated} entries deactivated`,
  );
};

/**
 * Only run when this file IS the command, not when a test imports planDedupe.
 * argv[1] rather than require.main, which is not defined under ESM.
 */
const invokedDirectly = (process.argv[1] ?? "").includes("dedupe-breed-codes");

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
