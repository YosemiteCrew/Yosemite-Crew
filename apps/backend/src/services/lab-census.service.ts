import { Types } from "mongoose";
import CompanionModel from "src/models/companion";
import { ParentModel } from "src/models/parent";
import CodeMappingModel from "src/models/code-mapping";
import { IntegrationService } from "src/services/integration.service";
import { IdexxClient } from "src/integrations/idexx/idexx.client";
import { normalizeLabProvider } from "src/labs";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";

const lookupIdexxMapping = async (yosemiteCode: string) => {
  const mapping = isReadFromPostgres()
    ? await prisma.codeMapping.findFirst({
        where: {
          sourceSystem: "YOSEMITECODE",
          sourceCode: yosemiteCode,
          targetSystem: "IDEXX",
          active: true,
        },
      })
    : await CodeMappingModel.findOne({
        sourceSystem: "YOSEMITECODE",
        sourceCode: yosemiteCode,
        targetSystem: "IDEXX",
        active: true,
      }).lean();

  if (!mapping) {
    throw new LabOrderServiceError(
      `Missing IDEXX mapping for code ${yosemiteCode}.`,
      400,
    );
  }

  return mapping.targetCode;
};

const resolveGenderCode = (gender: string, isNeutered?: boolean) => {
  if (gender === "male") {
    return isNeutered === true ? "MALE_NEUTERED" : "MALE_INTACT";
  }
  if (gender === "female") {
    return isNeutered === true ? "FEMALE_SPAYED" : "FEMALE_INTACT";
  }
  return "UNKNOWN";
};

type IdLike = Types.ObjectId | string;

const ensureObjectIdLike = (value: IdLike, field: string): Types.ObjectId => {
  if (value instanceof Types.ObjectId) {
    return value;
  }
  if (!Types.ObjectId.isValid(value)) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return new Types.ObjectId(value);
};

const resolveDocId = (doc: { id?: string; _id?: { toString(): string } }) => {
  if ("id" in doc && typeof doc.id === "string") return doc.id;
  if ("_id" in doc && doc._id) return doc._id.toString();
  throw new LabOrderServiceError("Missing document id.", 500);
};

const buildCensusPayload = async (input: {
  companionId: IdLike;
  parentId: IdLike;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const safeCompanionId = ensureObjectIdLike(input.companionId, "companionId");
  const safeParentId = ensureObjectIdLike(input.parentId, "parentId");
  const companion = isReadFromPostgres()
    ? await prisma.companion.findUnique({
        where: { id: safeCompanionId.toString() },
      })
    : await CompanionModel.findById(safeCompanionId)
        .setOptions({ sanitizeFilter: true })
        .lean();
  if (!companion) {
    throw new LabOrderServiceError("Companion not found.", 404);
  }

  const parent = isReadFromPostgres()
    ? await prisma.parent.findUnique({
        where: { id: safeParentId.toString() },
        include: { address: true },
      })
    : await ParentModel.findById(safeParentId)
        .setOptions({ sanitizeFilter: true })
        .lean();
  if (!parent) {
    throw new LabOrderServiceError("Parent not found.", 404);
  }

  if (!parent.lastName) {
    throw new LabOrderServiceError(
      "Parent last name is required for IDEXX census.",
      400,
    );
  }

  if (!companion.speciesCode || !companion.breedCode) {
    throw new LabOrderServiceError(
      "Companion speciesCode and breedCode are required.",
      400,
    );
  }

  const speciesCode = await lookupIdexxMapping(companion.speciesCode);
  const breedCode = await lookupIdexxMapping(companion.breedCode);
  const genderCode = resolveGenderCode(
    companion.gender,
    companion.isNeutered ?? undefined,
  );

  return {
    patient: {
      patientId: resolveDocId(companion),
      name: companion.name,
      microchip: companion.microchipNumber ?? undefined,
      speciesCode,
      breedCode,
      genderCode,
      birthdate: companion.dateOfBirth
        ? companion.dateOfBirth.toISOString().split("T")[0]
        : undefined,
      client: {
        id: resolveDocId(parent),
        firstName: parent.firstName,
        lastName: parent.lastName,
        address: {
          street1: parent.address?.addressLine ?? undefined,
          city: parent.address?.city ?? undefined,
          stateProvince: parent.address?.state ?? undefined,
          postalCode: parent.address?.postalCode ?? undefined,
          country: parent.address?.country ?? undefined,
          email: parent.email ?? undefined,
          phone: parent.phoneNumber ?? undefined,
        },
      },
    },
    veterinarian: input.veterinarian ?? undefined,
    ivls: input.ivls ?? undefined,
  };
};

const buildClientForOrg = async (organisationId: string) => {
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

const requireIdexxProvider = (providerInput: string) => {
  const provider = normalizeLabProvider(providerInput);
  if (!provider || provider !== "IDEXX") {
    throw new LabOrderServiceError("Unsupported lab provider.", 400);
  }
  return provider;
};

export const LabCensusService = {
  async listIvlsDevices(providerInput: string, organisationId: string) {
    requireIdexxProvider(providerInput);

    const client = await buildClientForOrg(organisationId);
    return client.listIvlsDevices();
  },

  async listCensus(providerInput: string, organisationId: string) {
    requireIdexxProvider(providerInput);

    const client = await buildClientForOrg(organisationId);
    return client.listCensus();
  },

  async deleteCensus(providerInput: string, organisationId: string) {
    requireIdexxProvider(providerInput);

    const client = await buildClientForOrg(organisationId);
    return client.deleteCensus();
  },

  async getCensusById(
    providerInput: string,
    organisationId: string,
    censusId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    if (provider !== "IDEXX") {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const client = await buildClientForOrg(organisationId);
    return client.getCensusById(censusId);
  },

  async deleteCensusById(
    providerInput: string,
    organisationId: string,
    censusId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    if (provider !== "IDEXX") {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const client = await buildClientForOrg(organisationId);
    return client.deleteCensusById(censusId);
  },

  async getCensusPatient(
    providerInput: string,
    organisationId: string,
    patientId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    if (provider !== "IDEXX") {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const client = await buildClientForOrg(organisationId);
    return client.getCensusPatient(patientId);
  },

  async addCensusPatient(
    providerInput: string,
    organisationId: string,
    input: {
      companionId: string;
      parentId?: string;
      veterinarian?: string | null;
      ivls?: Array<{ serialNumber: string } | string>;
    },
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    if (provider !== "IDEXX") {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    if (!input.parentId) {
      throw new LabOrderServiceError("parentId is required for census.", 400);
    }

    const safeCompanionId = ensureObjectIdLike(
      input.companionId,
      "companionId",
    );
    const safeParentId = ensureObjectIdLike(input.parentId, "parentId");

    const companionId = isReadFromPostgres()
      ? safeCompanionId.toString()
      : safeCompanionId;
    const parentId = isReadFromPostgres()
      ? safeParentId.toString()
      : safeParentId;

    const normalizedIvls = input.ivls?.map((item) =>
      typeof item === "string" ? { serialNumber: item } : item,
    );

    const payload = await buildCensusPayload({
      companionId,
      parentId,
      veterinarian: input.veterinarian ?? undefined,
      ivls: normalizedIvls,
    });

    const client = await buildClientForOrg(organisationId);
    return client.addCensusPatient(payload);
  },

  async deleteCensusPatient(
    providerInput: string,
    organisationId: string,
    patientId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    if (provider !== "IDEXX") {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const client = await buildClientForOrg(organisationId);
    return client.deleteCensusPatient(patientId);
  },
};
