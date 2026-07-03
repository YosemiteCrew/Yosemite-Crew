import "dotenv/config";
import { Prisma, type TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  DEFAULT_LIBRARY_TEMPLATE_SEEDS,
  type DefaultLibraryTemplateSeed,
} from "./template-library-seed.data";

const seedTemplate = async (
  seed: DefaultLibraryTemplateSeed & {
    ownership: "YC_LIBRARY";
    scope: "ORGANISATION";
    rules: { appliesTo: { defaultForKind: true } };
  },
) => {
  const template = await prisma.template.upsert({
    where: { id: seed.id },
    create: {
      id: seed.id,
      organisationId: null,
      ownerUserId: null,
      ownership: seed.ownership,
      kind: seed.kind as TemplateKind,
      name: seed.name,
      description: seed.description,
      status: "PUBLISHED",
      scope: seed.scope,
      rules: seed.rules as Prisma.InputJsonValue,
      latestVersion: 1,
      publishedVersion: 1,
      createdBy: "SYSTEM",
      updatedBy: "SYSTEM",
    },
    update: {
      ownership: seed.ownership,
      kind: seed.kind as TemplateKind,
      name: seed.name,
      description: seed.description,
      status: "PUBLISHED",
      scope: seed.scope,
      rules: seed.rules as Prisma.InputJsonValue,
      latestVersion: 1,
      publishedVersion: 1,
      updatedBy: "SYSTEM",
    },
  });

  await prisma.templateVersion.upsert({
    where: {
      templateId_version: {
        templateId: template.id,
        version: 1,
      },
    },
    create: {
      templateId: template.id,
      version: 1,
      schemaSnapshot: seed.schemaSnapshot as unknown as Prisma.InputJsonValue,
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
      createdBy: "SYSTEM",
    },
    update: {
      schemaSnapshot: seed.schemaSnapshot as unknown as Prisma.InputJsonValue,
      renderConfigSnapshot: {},
      validationSnapshot: {},
      publishedAt: new Date(),
    },
  });
};

const main = async () => {
  for (const seed of DEFAULT_LIBRARY_TEMPLATE_SEEDS) {
    await seedTemplate(seed);
  }

  console.log(
    `Seeded ${DEFAULT_LIBRARY_TEMPLATE_SEEDS.length} default library templates.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
