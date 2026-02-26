import { IdexxClient } from "src/integrations/idexx/idexx.client";
import { CodeService } from "src/services/code.service";
import { CodeSyncService } from "src/services/code-sync.service";
import type { CodeSyncKind } from "src/models/code-sync-state";
import logger from "src/utils/logger";

const SPECIES_ALLOWED = new Set(["canine", "feline", "equine"]);

type IdexxVersionResponse = Record<string, string>;

type IdexxRefList<T> = {
  list: T[];
  version: string;
};

type IdexxSpecies = { code: string; name: string };
type IdexxBreed = { code: string; name: string; speciesCode: string };
type IdexxGender = { code: string; name: string };
type IdexxTest = {
  code: string;
  name: string;
  listPrice?: string;
  currencyCode?: string;
  turnaround?: string;
  specimen?: string;
  addOn?: boolean;
  allowsBatch?: boolean;
  allowsAddOns?: boolean;
  displayCode?: string;
};

const getEnv = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim() ? value : null;
};

const mapIdexxSpecies = (code: string, name?: string) => {
  const normalized = code.trim().toUpperCase();
  if (["CANINE", "DOG"].includes(normalized)) return "canine";
  if (["FELINE", "CAT"].includes(normalized)) return "feline";
  if (["EQUINE", "HORSE"].includes(normalized)) return "equine";

  const label = (name ?? "").toLowerCase();
  if (label.includes("dog") || label.includes("canine")) return "canine";
  if (label.includes("cat") || label.includes("feline")) return "feline";
  if (label.includes("horse") || label.includes("equine")) return "equine";

  return null;
};

const buildSpeciesCode = (species: string) =>
  `YSPEC:${species.toUpperCase()}`;

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const buildBreedCode = (species: string, raw: string) =>
  `YBREED:${species.toUpperCase()}:${slugify(raw).toUpperCase()}`;

const ensureSpeciesEntry = async (species: string) => {
  if (!SPECIES_ALLOWED.has(species)) return null;
  const code = buildSpeciesCode(species);
  await CodeService.upsertEntry({
    system: "YOSEMITECODE",
    code,
    display: species.charAt(0).toUpperCase() + species.slice(1),
    type: "SPECIES",
    active: true,
    synonyms: [],
    meta: { source: "idexx-sync" },
  });
  return code;
};

const syncSpecies = async (data: IdexxRefList<IdexxSpecies>) => {
  for (const entry of data.list) {
    const species = mapIdexxSpecies(entry.code, entry.name);
    if (!species) continue;

    const sourceCode = await ensureSpeciesEntry(species);
    if (!sourceCode) continue;

    await CodeService.upsertMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode,
      targetSystem: "IDEXX",
      targetCode: entry.code,
      targetDisplay: entry.name,
      targetVersion: data.version,
      active: true,
    });
  }
};

const syncBreeds = async (data: IdexxRefList<IdexxBreed>) => {
  for (const entry of data.list) {
    const species = mapIdexxSpecies(entry.speciesCode);
    if (!species) continue;

    const speciesCode = await ensureSpeciesEntry(species);
    if (!speciesCode) continue;

    const breedCode = buildBreedCode(species, entry.code);

    await CodeService.upsertEntry({
      system: "YOSEMITECODE",
      code: breedCode,
      display: entry.name,
      type: "BREED",
      active: true,
      synonyms: [],
      meta: {
        species,
        speciesCode,
        source: "idexx-sync",
      },
    });

    await CodeService.upsertMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode: breedCode,
      targetSystem: "IDEXX",
      targetCode: entry.code,
      targetDisplay: entry.name,
      targetVersion: data.version,
      active: true,
    });
  }
};

const syncGenders = async (data: IdexxRefList<IdexxGender>) => {
  for (const entry of data.list) {
    await CodeService.upsertEntry({
      system: "IDEXX",
      code: entry.code,
      display: entry.name,
      type: "GENDER",
      active: true,
      synonyms: [],
      meta: { source: "idexx-sync", version: data.version },
    });
  }
};

const syncTests = async (data: IdexxRefList<IdexxTest>) => {
  for (const entry of data.list) {
    await CodeService.upsertEntry({
      system: "IDEXX",
      code: entry.code,
      display: entry.name,
      type: "TEST",
      active: true,
      synonyms: [],
      meta: {
        source: "idexx-sync",
        version: data.version,
        listPrice: entry.listPrice,
        currencyCode: entry.currencyCode,
        turnaround: entry.turnaround,
        specimen: entry.specimen,
        addOn: entry.addOn,
        allowsBatch: entry.allowsBatch,
        allowsAddOns: entry.allowsAddOns,
        displayCode: entry.displayCode,
      },
    });
  }
};

const shouldSync = async (kind: CodeSyncKind, version: string) => {
  const state = await CodeSyncService.get("IDEXX", kind);
  return !state || state.version !== version;
};

const markSynced = async (kind: CodeSyncKind, version: string) => {
  await CodeSyncService.upsert({
    system: "IDEXX",
    kind,
    version,
    lastSyncedAt: new Date(),
  });
};

export const IdexxReferenceService = {
  async syncAll() {
    const username = getEnv("IDEXX_GLOBAL_USERNAME");
    const password = getEnv("IDEXX_GLOBAL_PASSWORD");
    const labAccountId = getEnv("IDEXX_GLOBAL_LAB_ACCOUNT_ID") ?? undefined;
    const pimsId = getEnv("IDEXX_PIMS_ID");
    const pimsVersion = getEnv("IDEXX_PIMS_VERSION");

    if (!username || !password || !pimsId || !pimsVersion) {
      logger.warn(
        "IDEXX reference sync skipped: missing global IDEXX credentials or PIMS config.",
      );
      return;
    }

    const client = new IdexxClient({
      username,
      password,
      labAccountId: labAccountId ?? undefined,
      pimsId,
      pimsVersion,
    });

    const versions = (await client.getRefVersions()) as IdexxVersionResponse;

    if (versions.species && (await shouldSync("species", versions.species))) {
      const species = (await client.getRefSpecies()) as IdexxRefList<IdexxSpecies>;
      await syncSpecies(species);
      await markSynced("species", species.version);
    }

    if (versions.breeds && (await shouldSync("breeds", versions.breeds))) {
      const breeds = (await client.getRefBreeds()) as IdexxRefList<IdexxBreed>;
      await syncBreeds(breeds);
      await markSynced("breeds", breeds.version);
    }

    if (versions.genders && (await shouldSync("genders", versions.genders))) {
      const genders = (await client.getRefGenders()) as IdexxRefList<IdexxGender>;
      await syncGenders(genders);
      await markSynced("genders", genders.version);
    }

    if (versions.tests && (await shouldSync("tests", versions.tests))) {
      const tests = (await client.getRefTests()) as IdexxRefList<IdexxTest>;
      await syncTests(tests);
      await markSynced("tests", tests.version);
    }

    logger.info("IDEXX reference sync complete.");
  },
};
