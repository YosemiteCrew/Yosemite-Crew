import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";
import type { MappingEquivalence } from "src/models/code-mapping";

/**
 * Projecting a coded record into another vocabulary is where a crosswalk stops being a
 * reference table and starts making clinical claims. Two rules hold throughout:
 *
 * 1. Never fall back. If a term has no counterpart in the requested system, say so. The
 *    tempting alternatives - emit the YC code as though it were SNOMED, or substitute a
 *    parent concept - both produce an export that looks complete and is not.
 * 2. Never let the preference narrow input. It governs output only. SNOMED covers 344 of
 *    our 4,819 exotics terms; a preference that filtered the picker would leave an
 *    exotics vet unable to record what is in front of them.
 */
export type ProjectionTarget = "YOSEMITECODE" | "VENOM" | "SNOMED";

export type ProjectedCode =
  | {
      status: "mapped";
      ycCode: string;
      system: ProjectionTarget;
      code: string;
      display: string | null;
      equivalence: MappingEquivalence;
    }
  | { status: "unmapped"; ycCode: string; system: ProjectionTarget }
  | { status: "unknown"; ycCode: string; system: ProjectionTarget };

export type VocabularyCoverage = {
  system: ProjectionTarget;
  species: string | null;
  terms: number;
  mapped: number;
  /** Whole percent, floored: 6% must not round up to 7% in a disclosure. */
  percent: number;
};

const isTerminal = (system: ProjectionTarget) => system === "YOSEMITECODE";

export const TerminologyProjectionService = {
  /**
   * Projects several codes at once. Batched deliberately: a SOAP note or an export runs
   * to hundreds of codes, and one query per code would make the honest path the slow one.
   */
  async projectCodes(
    ycCodes: string[],
    system: ProjectionTarget,
  ): Promise<ProjectedCode[]> {
    const wanted = [
      ...new Set(ycCodes.map((code) => code.trim()).filter(Boolean)),
    ];
    if (wanted.length === 0) return [];

    // Asking for our own vocabulary is not a projection; it still has to confirm the
    // code exists rather than echoing whatever it was handed.
    if (isTerminal(system)) {
      const known = await prisma.codeEntry.findMany({
        where: { system: "YOSEMITECODE", code: { in: wanted }, active: true },
        select: { code: true, display: true },
      });
      const byCode = new Map(known.map((row) => [row.code, row.display]));
      return wanted.map((ycCode) =>
        byCode.has(ycCode)
          ? {
              status: "mapped" as const,
              ycCode,
              system,
              code: ycCode,
              display: byCode.get(ycCode) ?? null,
              equivalence: "EQUIVALENT" as MappingEquivalence,
            }
          : { status: "unknown" as const, ycCode, system },
      );
    }

    const [mappings, known] = await Promise.all([
      prisma.codeMapping.findMany({
        where: {
          sourceSystem: "YOSEMITECODE",
          sourceCode: { in: wanted },
          targetSystem: system,
          active: true,
        },
        select: {
          sourceCode: true,
          targetCode: true,
          targetDisplay: true,
          equivalence: true,
        },
        // A term can carry more than one code in a system. Deterministic order so the
        // same record projects the same way every time.
        orderBy: { targetCode: "asc" },
      }),
      prisma.codeEntry.findMany({
        where: { system: "YOSEMITECODE", code: { in: wanted }, active: true },
        select: { code: true },
      }),
    ]);

    const mapped = new Map(mappings.map((row) => [row.sourceCode, row]));
    const exists = new Set(known.map((row) => row.code));

    return wanted.map((ycCode) => {
      const hit = mapped.get(ycCode);
      if (hit) {
        return {
          status: "mapped" as const,
          ycCode,
          system,
          code: hit.targetCode,
          display: hit.targetDisplay,
          equivalence: hit.equivalence,
        };
      }
      // An unknown code and a code with no counterpart are different failures: the first
      // is a bug in the caller, the second is a real gap in the target vocabulary.
      return exists.has(ycCode)
        ? { status: "unmapped" as const, ycCode, system }
        : { status: "unknown" as const, ycCode, system };
    });
  },

  async projectCode(
    ycCode: string,
    system: ProjectionTarget,
  ): Promise<ProjectedCode> {
    const [only] = await this.projectCodes([ycCode], system);
    return only ?? { status: "unknown", ycCode, system };
  },

  /**
   * What a practice needs to see before choosing. The honest number is per species,
   * because the aggregate hides the cases that matter: SNOMED reaches 50% of small
   * animal terms and 7% of exotics.
   */
  async vocabularyCoverage(
    system: ProjectionTarget,
    species?: string,
  ): Promise<VocabularyCoverage> {
    const speciesFilter = species
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(
            CASE WHEN jsonb_typeof(e."meta"->'species') = 'array'
                 THEN e."meta"->'species' ELSE '[]'::jsonb END
          ) sp WHERE sp = ${species}
        )`
      : Prisma.empty;

    const mappedExpression = isTerminal(system)
      ? Prisma.sql`COUNT(*)`
      : Prisma.sql`COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM "CodeMapping" m
          WHERE m."sourceCode" = e."code"
            AND m."sourceSystem" = 'YOSEMITECODE'::"CodeSystem"
            AND m."targetSystem" = ${system}::"CodeSystem"
            AND m."active"
        ))`;

    const [row] = await prisma.$queryRaw<
      Array<{ terms: bigint; mapped: bigint }>
    >`
      SELECT COUNT(*) AS terms, ${mappedExpression} AS mapped
      FROM "CodeEntry" e
      WHERE e."system" = 'YOSEMITECODE'::"CodeSystem"
        AND e."type" = 'CLINICAL_TERM'::"CodeType"
        AND e."active"
        ${speciesFilter}
    `;

    const terms = Number(row?.terms ?? 0);
    const mapped = Number(row?.mapped ?? 0);

    return {
      system,
      species: species ?? null,
      terms,
      mapped,
      percent: terms === 0 ? 0 : Math.floor((mapped * 100) / terms),
    };
  },
};
