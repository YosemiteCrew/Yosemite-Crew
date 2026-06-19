import { Types } from "mongoose";
import CompanionModel from "src/models/companion";
import { ParentModel } from "src/models/parent";
import CompanionOrganisationModel from "src/models/companion-organisation";
import ParentCompanionModel from "src/models/parent-companion";
import { normalizeLabProvider } from "src/labs";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import {
  buildIdexxClient,
  lookupIdexxMapping,
} from "src/labs/idexx/idexx.shared";

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

const ensureObjectIdString = (value: unknown, field: string): string => {
  if (value instanceof Types.ObjectId) return value.toString();
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return value;
};

const resolveDocId = (doc: { id?: string; _id?: { toString(): string } }) => {
  if ("id" in doc && typeof doc.id === "string") return doc.id;
  if ("_id" in doc && doc._id) return doc._id.toString();
  throw new LabOrderServiceError("Missing document id.", 500);
};

const buildCensusPayload = async (input: {
  organisationId: string;
  patientId: IdLike;
  parentId: IdLike;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const safeCompanionIdString = ensureObjectIdString(
    input.patientId,
    "patientId",
  );
  const safeParentIdString = ensureObjectIdString(input.parentId, "parentId");
  const safeCompanionId = new Types.ObjectId(safeCompanionIdString);
  const safeParentId = new Types.ObjectId(safeParentIdString);

  if (isReadFromPostgres()) {
    const [companionOrgLink, parentCompanionLink] = await Promise.all([
      prisma.patientOrganisation.findFirst({
        where: {
          organisationId: input.organisationId,
          patientId: safeCompanionId.toString(),
          status: { in: ["ACTIVE", "PENDING"] },
        },
        select: { id: true },
      }),
      prisma.parentPatient.findFirst({
        where: {
          parentId: safeParentId.toString(),
          patientId: safeCompanionId.toString(),
          status: { in: ["ACTIVE", "PENDING"] },
        },
        select: { id: true },
      }),
    ]);

    if (!companionOrgLink) {
      throw new LabOrderServiceError("Companion not found.", 404);
    }
    if (!parentCompanionLink) {
      throw new LabOrderServiceError("Parent not found.", 404);
    }
  } else {
    const safeOrganisationIdString = ensureObjectIdString(
      input.organisationId,
      "organisationId",
    );

    const companionOrgLink = (await CompanionOrganisationModel.findOne({
      organisationId: { $eq: safeOrganisationIdString },
      patientId: { $eq: safeCompanionIdString },
      status: { $in: ["ACTIVE", "PENDING"] },
    })
      .setOptions({ sanitizeFilter: true })
      .select({ _id: 1 })
      .lean()
      .exec()) as unknown as { _id: unknown } | null;
    const parentCompanionLink = (await ParentCompanionModel.findOne({
      parentId: { $eq: safeParentIdString },
      patientId: { $eq: safeCompanionIdString },
      status: { $in: ["ACTIVE", "PENDING"] },
    })
      .setOptions({ sanitizeFilter: true })
      .select({ _id: 1 })
      .lean()
      .exec()) as unknown as { _id: unknown } | null;

    if (!companionOrgLink) {
      throw new LabOrderServiceError("Companion not found.", 404);
    }
    if (!parentCompanionLink) {
      throw new LabOrderServiceError("Parent not found.", 404);
    }
  }

  const companion = isReadFromPostgres()
    ? await prisma.patient.findUnique({
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

  const speciesCode = await lookupIdexxMapping(
    companion.speciesCode,
    "species",
  );
  const breedCode = await lookupIdexxMapping(companion.breedCode, "breed");
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

    const client = await buildIdexxClient(organisationId);
    return client.listIvlsDevices();
  },

  async listCensus(providerInput: string, organisationId: string) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.listCensus();
  },

  async deleteCensus(providerInput: string, organisationId: string) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.deleteCensus();
  },

  async getCensusById(
    providerInput: string,
    organisationId: string,
    censusId: string,
  ) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.getCensusById(censusId);
  },

  async deleteCensusById(
    providerInput: string,
    organisationId: string,
    censusId: string,
  ) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.deleteCensusById(censusId);
  },

  async getCensusPatient(
    providerInput: string,
    organisationId: string,
    patientId: string,
  ) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.getCensusPatient(patientId);
  },

  async addCensusPatient(
    providerInput: string,
    organisationId: string,
    input: {
      patientId: string;
      parentId?: string;
      veterinarian?: string | null;
      ivls?: Array<{ serialNumber: string } | string>;
    },
  ) {
    requireIdexxProvider(providerInput);

    if (!input.parentId) {
      throw new LabOrderServiceError("parentId is required for census.", 400);
    }

    const normalizedIvls = input.ivls?.map((item) =>
      typeof item === "string" ? { serialNumber: item } : item,
    );

    const payload = await buildCensusPayload({
      organisationId,
      patientId: input.patientId,
      parentId: input.parentId,
      veterinarian: input.veterinarian ?? undefined,
      ivls: normalizedIvls,
    });

    const client = await buildIdexxClient(organisationId);
    return client.addCensusPatient(payload);
  },

  async deleteCensusPatient(
    providerInput: string,
    organisationId: string,
    patientId: string,
  ) {
    requireIdexxProvider(providerInput);

    const client = await buildIdexxClient(organisationId);
    return client.deleteCensusPatient(patientId);
  },
};
