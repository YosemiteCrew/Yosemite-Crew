import { prisma } from "src/config/prisma";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { IntegrationService } from "src/services/integration.service";
import { IdexxClient } from "src/integrations/idexx/idexx.client";
import type { LabBreedSubstitution } from "src/labs/types";

export type IdexxLookupField = "species" | "breed" | "providerCode";

const MAPPING_ERROR_CODES: Record<IdexxLookupField, string> = {
  species: "DIAGNOSTIC_SPECIES_MAPPING_UNSUPPORTED",
  breed: "DIAGNOSTIC_BREED_MAPPING_UNSUPPORTED",
  providerCode: "DIAGNOSTIC_PROVIDER_CODE_MAPPING_UNSUPPORTED",
};

const findIdexxTargetCode = async (yosemiteCode: string) => {
  const mapping = await prisma.codeMapping.findFirst({
    where: {
      sourceSystem: "YOSEMITECODE",
      sourceCode: yosemiteCode,
      targetSystem: "IDEXX",
      active: true,
    },
  });

  return mapping?.targetCode ?? null;
};

const mappingError = (yosemiteCode: string, field: IdexxLookupField) =>
  new LabOrderServiceError(
    `Missing IDEXX mapping for code ${yosemiteCode}.`,
    400,
    MAPPING_ERROR_CODES[field],
    {
      provider: "IDEXX",
      field,
      code: yosemiteCode,
      sourceSystem: "YOSEMITECODE",
      targetSystem: "IDEXX",
    },
  );

/**
 * IDEXX only accepts breeds from its own reference list, which the sync mints as
 * YBREED:<SPECIES>:<CODE>. Breeds minted from VeNOM have no IDEXX counterpart, so on
 * dev only 371 of 1,749 breeds could reach IDEXX at all - and none of the four horses.
 *
 * IDEXX does publish a species-level catch-all, so an unmapped breed no longer has to
 * block the order. Note the asymmetry: canine and equine have a true "Other", but IDEXX
 * offers no generic "Feline, Other", so cats fall back to "Feline, Mixed Breed" - which
 * asserts something the record may not support. Every substitution is therefore returned
 * to the caller instead of being applied silently.
 */
export const SPECIES_FALLBACK_BREED_CODE: Record<string, string> = {
  "YSPEC:CANINE": "YBREED:CANINE:CANINE_OTHER",
  "YSPEC:FELINE": "YBREED:FELINE:MIXED_BREED_FELINE",
  "YSPEC:EQUINE": "YBREED:EQUINE:EQUINE_OTHER",
};

const SPECIES_CODE_BY_TYPE: Record<string, string> = {
  dog: "YSPEC:CANINE",
  canine: "YSPEC:CANINE",
  cat: "YSPEC:FELINE",
  feline: "YSPEC:FELINE",
  horse: "YSPEC:EQUINE",
  equine: "YSPEC:EQUINE",
};

/**
 * Ten of the 44 companions on dev carry no speciesCode but do carry a type. The stored
 * code wins where present so existing behaviour is untouched; type is only a backstop.
 */
export const resolveCompanionSpeciesCode = (companion: {
  speciesCode?: string | null;
  type?: string | null;
}): string | null => {
  const stored = companion.speciesCode?.trim();
  if (stored) return stored;
  const type = companion.type?.trim().toLowerCase();
  return type ? (SPECIES_CODE_BY_TYPE[type] ?? null) : null;
};

export type IdexxBreedSubstitution = LabBreedSubstitution;

/**
 * A breed code carries its species in the code itself, so a companion's breed code
 * disagreeing with its species means one of the two is wrong. No live record violates
 * this today, but nothing enforces it either, and the failure would be silent and bad:
 * an equine breed sent on a canine order, which is a clinical claim about the animal.
 * Treat a mismatch as unusable and fall back to the species catch-all instead.
 */
const breedBelongsToSpecies = (breedCode: string, speciesCode: string) => {
  const species = speciesCode.startsWith("YSPEC:")
    ? speciesCode.slice("YSPEC:".length)
    : null;
  // A non-canonical species code makes no claim we can check, so do not block on it.
  if (!species) return true;
  return breedCode.startsWith(`YBREED:${species}:`);
};

const mismatchReason = (
  requested: string | null,
  mismatched: boolean,
): IdexxBreedSubstitution["reason"] => {
  if (!requested) return "UNCODED_BREED";
  return mismatched ? "MISMATCHED_BREED" : "UNMAPPED_BREED";
};

export const resolveIdexxBreedCode = async (args: {
  speciesCode: string;
  breedCode?: string | null;
}): Promise<{
  targetCode: string;
  substitution: IdexxBreedSubstitution | null;
}> => {
  const requested = args.breedCode?.trim() || null;
  const mismatched =
    requested !== null && !breedBelongsToSpecies(requested, args.speciesCode);

  if (requested && !mismatched) {
    const direct = await findIdexxTargetCode(requested);
    if (direct) return { targetCode: direct, substitution: null };
  }

  const fallbackSource = SPECIES_FALLBACK_BREED_CODE[args.speciesCode];
  const fallbackTarget = fallbackSource
    ? await findIdexxTargetCode(fallbackSource)
    : null;

  if (!fallbackTarget || !fallbackSource) {
    throw mappingError(requested ?? args.speciesCode, "breed");
  }

  return {
    targetCode: fallbackTarget,
    substitution: {
      requestedBreedCode: requested,
      usedBreedCode: fallbackSource,
      usedTargetCode: fallbackTarget,
      reason: mismatchReason(requested, mismatched),
    },
  };
};

export const lookupIdexxMapping = async (
  yosemiteCode: string,
  field: IdexxLookupField = "providerCode",
) => {
  const targetCode = await findIdexxTargetCode(yosemiteCode);

  if (!targetCode) {
    throw mappingError(yosemiteCode, field);
  }

  return targetCode;
};

export const buildIdexxClient = async (organisationId: string) => {
  const account = await IntegrationService.requireAccount(
    organisationId,
    "IDEXX",
  );

  const credentials = account.credentials as {
    username?: string;
    password?: string;
    labAccountId?: string;
  };

  if (!credentials?.username || !credentials.password) {
    throw new LabOrderServiceError("IDEXX credentials missing.", 400);
  }

  const pimsId = process.env.IDEXX_PIMS_ID;
  const pimsVersion = process.env.IDEXX_PIMS_VERSION;

  if (!pimsId || !pimsVersion) {
    throw new LabOrderServiceError("IDEXX PIMS config missing.", 500);
  }

  return new IdexxClient({
    username: credentials.username,
    password: credentials.password,
    labAccountId: credentials.labAccountId,
    pimsId,
    pimsVersion,
  });
};
