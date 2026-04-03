import "dotenv/config";
import mongoose from "mongoose";
import path from "node:path";
import { ClinicalTermsService } from "src/services/clinical-terms.service";

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is required to import clinical terms.");
  }

  const inputPath =
    process.argv[2] ??
    process.env.CLINICAL_TERMS_INPUT ??
    path.resolve(process.cwd(), "data", "yc_concepts.json");

  await mongoose.connect(mongoUri);

  try {
    const result = await ClinicalTermsService.importFromFile(inputPath);
    console.log(
      `Clinical terms import complete. entries=${result.entriesUpserted} mappings=${result.mappingsUpserted}`,
    );
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
