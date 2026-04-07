import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { CodeService } from "src/services/code.service";
import type { CodeType } from "src/models/code-entry";

type BreedSeedItem = {
  species: "canine" | "feline" | "equine";
  speciesCode: number;
  venomId: number;
  name: string;
  slug: string;
  active: boolean;
  synonyms: string[];
  type: "PUREBRED" | "CROSS" | "UNSPECIFIED";
  flags: { isCross: boolean; isUnspecified: boolean };
};

const SPECIES_DISPLAY: Record<string, string> = {
  canine: "Canine",
  feline: "Feline",
  equine: "Equine",
};

const buildSpeciesCode = (species: string) => `YSPEC:${species.toUpperCase()}`;

const buildBreedCode = (species: string, slug: string) =>
  `YBREED:${species.toUpperCase()}:${slug.toUpperCase()}`;

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
};

const seedSpecies = async (species: string) => {
  const code = buildSpeciesCode(species);
  const display = SPECIES_DISPLAY[species] ?? species;
  await CodeService.upsertEntry({
    system: "YOSEMITECODE",
    code,
    display,
    type: "SPECIES" as CodeType,
    active: true,
    synonyms: [],
    meta: { source: "seed" },
  });
};

const seedBreedsFromFile = async (filePath: string) => {
  const items = readJson<BreedSeedItem[]>(filePath);

  for (const item of items) {
    const speciesCode = buildSpeciesCode(item.species);
    const breedCode = buildBreedCode(item.species, item.slug);

    await CodeService.upsertEntry({
      system: "YOSEMITECODE",
      code: breedCode,
      display: item.name,
      type: "BREED",
      active: item.active,
      synonyms: item.synonyms,
      meta: {
        species: item.species,
        speciesCode,
        breedType: item.type,
        flags: item.flags,
      },
    });

    await CodeService.upsertMapping({
      sourceSystem: "YOSEMITECODE",
      sourceCode: breedCode,
      targetSystem: "VENOM",
      targetCode: String(item.venomId),
      targetDisplay: item.name,
      targetVersion: null,
      active: true,
    });
  }
};

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required to seed codebook.");
  }

  const inputDir =
    process.argv[2] ??
    process.env.CODEBOOK_INPUT_DIR ??
    path.join(process.cwd(), "data");

  const files = [
    "canine_breeds.json",
    "feline_breeds.json",
    "equine_breeds.json",
  ];

  await mongoose.connect(mongoUri);

  for (const species of ["canine", "feline", "equine"]) {
    await seedSpecies(species);
  }

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing seed file: ${filePath}`);
    }
    await seedBreedsFromFile(filePath);
  }

  await mongoose.disconnect();
  console.log("Codebook seed complete.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
