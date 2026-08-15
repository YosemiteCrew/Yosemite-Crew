import { prisma } from "src/config/prisma";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { IntegrationService } from "src/services/integration.service";
import { IdexxClient } from "src/integrations/idexx/idexx.client";

export type IdexxLookupField = "species" | "breed" | "providerCode";

const MAPPING_ERROR_CODES: Record<IdexxLookupField, string> = {
  species: "DIAGNOSTIC_SPECIES_MAPPING_UNSUPPORTED",
  breed: "DIAGNOSTIC_BREED_MAPPING_UNSUPPORTED",
  providerCode: "DIAGNOSTIC_PROVIDER_CODE_MAPPING_UNSUPPORTED",
};

export const lookupIdexxMapping = async (
  yosemiteCode: string,
  field: IdexxLookupField = "providerCode",
) => {
  const mapping = await prisma.codeMapping.findFirst({
    where: {
      sourceSystem: "YOSEMITECODE",
      sourceCode: yosemiteCode,
      targetSystem: "IDEXX",
      active: true,
    },
  });

  if (!mapping) {
    throw new LabOrderServiceError(
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
  }

  return mapping.targetCode;
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
