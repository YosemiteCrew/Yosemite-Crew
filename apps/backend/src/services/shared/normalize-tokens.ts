/**
 * Shared species-token normalization used by the appointment and
 * case-encounter services to validate room-unit species constraints.
 */
export type CompanionSpeciesSource = {
  type: string;
  speciesCode: string | null;
};

export const normalizeStringTokens = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          typeof item === "string" ? item.trim().toLowerCase() : "",
        )
        .filter((item) => item.length > 0),
    ),
  ];
};

const SPECIES_ALIASES: Record<string, string[]> = {
  dog: ["canine"],
  cat: ["feline"],
  horse: ["equine"],
  other: ["other"],
};

export const getCompanionSpeciesTokens = (
  companion: CompanionSpeciesSource,
): Set<string> => {
  const tokens = new Set<string>();
  const type = companion.type.trim().toLowerCase();

  if (type) {
    tokens.add(type);
  }

  if (companion.speciesCode?.trim()) {
    tokens.add(companion.speciesCode.trim().toLowerCase());
  }

  for (const alias of SPECIES_ALIASES[type] ?? []) {
    tokens.add(alias);
  }

  return tokens;
};

/**
 * True when the constraint list is empty or names at least one of the
 * companion's species tokens.
 */
export const isSpeciesCompatible = (
  constraintsSource: unknown,
  companion: CompanionSpeciesSource,
): boolean => {
  const constraints = normalizeStringTokens(constraintsSource);
  if (constraints.length === 0) {
    return true;
  }

  const allowedSpecies = getCompanionSpeciesTokens(companion);
  return constraints.some((constraint) => allowedSpecies.has(constraint));
};
