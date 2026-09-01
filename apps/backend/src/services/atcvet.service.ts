import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";

/**
 * Search and navigation over the ATCvet medication spine.
 *
 * A substance means little without the classification above it - "doxycycline"
 * reads very differently from "doxycycline · Tetracyclines · ANTIBACTERIALS FOR
 * SYSTEMIC USE" - so every result carries its ancestor path. The path costs no
 * extra graph traversal: an ATCvet code contains its own ancestry in its prefixes.
 */
export type MedicationSuggestion = {
  atcCode: string;
  label: string;
  /** Ancestor levels, outermost first, for context under the substance name. */
  path: Array<{ code: string; label: string }>;
  /** Species the code is specific to; only QI immunologicals carry these. */
  species: string[];
  /** True for QJ01, the systemic antibacterials that stewardship reporting counts. */
  antibacterial: boolean;
};

/** Prefix lengths of the four levels above a substance. */
const ANCESTOR_LENGTHS = [2, 4, 5, 6];

export const ancestorCodesOf = (code: string): string[] =>
  ANCESTOR_LENGTHS.filter((length) => length < code.length).map((length) =>
    code.slice(0, length),
  );

const escapeLike = (value: string) =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);

type MedicationRow = {
  code: string;
  display: string;
  meta: unknown;
};

const readMeta = (meta: unknown): Record<string, unknown> =>
  typeof meta === "object" && meta !== null && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};

export type SuggestMedicationsParams = {
  q?: string;
  /** Restrict to one anatomical main group, e.g. "QJ" for antiinfectives. */
  group?: string;
  /**
   * Species filter. Only immunologicals are species-specific, so a filtered
   * search still returns every general substance - excluding them would hide
   * doxycycline from a cat clinic.
   */
  species?: string;
  limit?: number;
};

export const buildMedicationQuery = ({
  q,
  group,
  species,
  limit = 20,
}: SuggestMedicationsParams): Prisma.Sql => {
  const term = q?.trim() ?? "";
  const contains = `%${escapeLike(term)}%`;
  const prefix = `${escapeLike(term)}%`;

  // Search the SAME expression the trigram index is built on
  // (code_entry_search_text(display, synonyms)); querying e."display" directly
  // cannot use that index, so every keystroke would scan the table the index was
  // added to avoid. The code is matched separately - it is not in the indexed
  // text, and a prefix match on a short code column is cheap.
  const search = term
    ? Prisma.sql`AND (
        code_entry_search_text(e."display", e."synonyms") ILIKE ${contains} ESCAPE '\\'
        OR e."code" ILIKE ${prefix} ESCAPE '\\'
      )`
    : Prisma.empty;

  const groupFilter = group
    ? Prisma.sql`AND e."meta"->>'atcGroup' = ${group.trim().toUpperCase()}`
    : Prisma.empty;

  // A substance with no species meta applies to every species, so it stays in a
  // filtered search. Immunologicals are the exception: they are species-specific
  // by construction, and QI20 ("immunologicals for other species") carries no
  // species precisely because we refuse to guess which. Letting it through on
  // "no species means all species" would offer a cat clinic a vaccine for an
  // animal nobody has identified.
  const speciesFilter = species
    ? Prisma.sql`AND (
        e."meta"->'species' @> ${JSON.stringify([species])}::jsonb
        OR (
          jsonb_typeof(e."meta"->'species') IS DISTINCT FROM 'array'
          AND e."meta"->>'atcGroup' IS DISTINCT FROM 'QI'
        )
      )`
    : Prisma.empty;

  // Ranking only means something when there is a term to rank against. Browsing a
  // group alphabetically must not pay for an ILIKE on every row.
  const ranking = term
    ? Prisma.sql`
      -- An exact code match first, then name-initial matches, then the rest:
      -- someone typing "QJ01AA02" wants that substance, not an alphabetical page.
      CASE WHEN e."code" = ${term.toUpperCase()} THEN 0
           WHEN e."display" ILIKE ${prefix} ESCAPE '\\' THEN 1
           ELSE 2 END,`
    : Prisma.empty;

  return Prisma.sql`
    SELECT e."code", e."display", e."meta"
    FROM "CodeEntry" e
    WHERE e."system" = 'ATCVET'::"CodeSystem"
      AND e."type" = 'MEDICATION'::"CodeType"
      AND e."active"
      ${search}
      ${groupFilter}
      ${speciesFilter}
    ORDER BY
      ${ranking}
      e."display" ASC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `;
};

export const AtcvetService = {
  async suggestMedications(
    params: SuggestMedicationsParams,
  ): Promise<MedicationSuggestion[]> {
    const rows = await prisma.$queryRaw<MedicationRow[]>(
      buildMedicationQuery(params),
    );
    if (rows.length === 0) return [];

    // One lookup for every ancestor on the page rather than one per result.
    const ancestorCodes = [
      ...new Set(rows.flatMap((row) => ancestorCodesOf(row.code))),
    ];
    const ancestors = await prisma.codeEntry.findMany({
      where: { system: "ATCVET", code: { in: ancestorCodes }, active: true },
      select: { code: true, display: true },
    });
    const labelByCode = new Map(
      ancestors.map((entry) => [entry.code, entry.display]),
    );

    return rows.map((row) => {
      const meta = readMeta(row.meta);
      return {
        atcCode: row.code,
        label: row.display,
        // A missing ancestor is dropped rather than rendered as a blank crumb.
        path: ancestorCodesOf(row.code).flatMap((code) => {
          const label = labelByCode.get(code);
          return label ? [{ code, label }] : [];
        }),
        species: Array.isArray(meta.species)
          ? meta.species.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
        antibacterial: meta.antibacterial === true,
      };
    });
  },
};
