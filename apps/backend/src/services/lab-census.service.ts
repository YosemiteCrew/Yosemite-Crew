import { normalizeLabProvider } from "src/labs";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { prisma } from "src/config/prisma";
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

const buildCensusPayload = async (input: {
  organisationId: string;
  patientId: string;
  parentId: string;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const [companionOrgLink, parentCompanionLink] = await Promise.all([
    prisma.patientOrganisation.findFirst({
      where: {
        organisationId: input.organisationId,
        patientId: input.patientId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: { id: true },
    }),
    prisma.parentPatient.findFirst({
      where: {
        parentId: input.parentId,
        patientId: input.patientId,
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

  const companion = await prisma.patient.findUnique({
    where: { id: input.patientId },
  });
  if (!companion) {
    throw new LabOrderServiceError("Companion not found.", 404);
  }

  const parent = await prisma.parent.findUnique({
    where: { id: input.parentId },
    include: { address: true },
  });
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
      patientId: companion.id,
      name: companion.name,
      microchip: companion.microchipNumber ?? undefined,
      speciesCode,
      breedCode,
      genderCode,
      birthdate: companion.dateOfBirth
        ? companion.dateOfBirth.toISOString().split("T")[0]
        : undefined,
      client: {
        id: parent.id,
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
