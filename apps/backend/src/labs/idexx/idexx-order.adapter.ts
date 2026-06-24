import { prisma } from "src/config/prisma";
import type {
  LabOrderAdapter,
  LabOrderCreateInput,
  LabOrderCreateResult,
} from "../types";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { normalizeLabStatus } from "src/labs/status";
import {
  buildIdexxClient,
  lookupIdexxMapping,
} from "src/labs/idexx/idexx.shared";

const coerceString = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  return null;
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

const validateTestCodes = async (tests: string[]) => {
  if (!tests.length) {
    throw new LabOrderServiceError("tests are required.", 400);
  }

  const count = await prisma.codeEntry.count({
    where: {
      system: "IDEXX",
      type: "TEST",
      code: { in: tests },
      active: true,
    },
  });

  if (count !== tests.length) {
    throw new LabOrderServiceError("One or more test codes are invalid.", 400);
  }
};

const loadCompanionAndParent = async (input: {
  patientId: string;
  parentId: string;
  parentLastNameError: string;
}) => {
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
    throw new LabOrderServiceError(input.parentLastNameError, 400);
  }

  if (!companion.speciesCode || !companion.breedCode) {
    throw new LabOrderServiceError(
      "Companion speciesCode and breedCode are required.",
      400,
    );
  }

  return { companion, parent };
};

const buildPatientPayload = async (input: {
  companion: {
    id: string;
    name?: string;
    gender?: string | null;
    isNeutered?: boolean | null;
    speciesCode?: string | null;
    breedCode?: string | null;
    microchipNumber?: string | null;
    dateOfBirth?: Date | null;
  };
  parent: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    address?: {
      addressLine?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
  };
}) => {
  const speciesCode = await lookupIdexxMapping(
    input.companion.speciesCode as string,
    "species",
  );
  const breedCode = await lookupIdexxMapping(
    input.companion.breedCode as string,
    "breed",
  );
  const genderCode = resolveGenderCode(
    input.companion.gender as string,
    input.companion.isNeutered ?? undefined,
  );

  return {
    patientId: input.companion.id,
    name: input.companion.name,
    microchip: input.companion.microchipNumber ?? undefined,
    speciesCode,
    breedCode,
    genderCode,
    birthdate: input.companion.dateOfBirth
      ? input.companion.dateOfBirth.toISOString().split("T")[0]
      : undefined,
    client: {
      id: input.parent.id,
      firstName: input.parent.firstName,
      lastName: input.parent.lastName,
      address: {
        street1: input.parent.address?.addressLine ?? undefined,
        city: input.parent.address?.city ?? undefined,
        stateProvince: input.parent.address?.state ?? undefined,
        postalCode: input.parent.address?.postalCode ?? undefined,
        country: input.parent.address?.country ?? undefined,
        email: input.parent.email ?? undefined,
        phone: input.parent.phoneNumber ?? undefined,
      },
    },
  };
};

const buildOrderResult = (
  response: Record<string, unknown>,
  requestPayload: Record<string, unknown>,
  idexxOrderId?: string | null,
): LabOrderCreateResult => {
  const statusInfo = normalizeLabStatus(response.status);

  return {
    requestPayload,
    responsePayload: response,
    idexxOrderId: idexxOrderId ?? coerceString(response.idexxOrderId),
    uiUrl: (response.uiURL as string) ?? null,
    pdfUrl: (response.pdfURL as string) ?? null,
    status: statusInfo.status ?? undefined,
    externalStatus: statusInfo.externalStatus,
  };
};

const buildOrderPayload = async (input: {
  patientId: string;
  parentId: string;
  tests: string[];
  modality?: "IN_HOUSE" | "REFERENCE_LAB";
  ivls?: Array<{ serialNumber: string }>;
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
}): Promise<Record<string, unknown>> => {
  const { companion, parent } = await loadCompanionAndParent({
    patientId: input.patientId,
    parentId: input.parentId,
    parentLastNameError: "Parent last name is required for IDEXX orders.",
  });

  await validateTestCodes(input.tests);

  if (input.modality === "IN_HOUSE") {
    if (!input.ivls || input.ivls.length === 0) {
      throw new LabOrderServiceError(
        "ivls is required for IN_HOUSE orders.",
        400,
      );
    }
  }

  const patient = await buildPatientPayload({ companion, parent });

  return {
    editable: false,
    patients: [patient],
    tests: input.tests,
    veterinarian: input.veterinarian ?? undefined,
    technician: input.technician ?? undefined,
    notes: input.notes ?? undefined,
    specimenCollectionDate: input.specimenCollectionDate ?? undefined,
    ivls: input.modality === "IN_HOUSE" ? input.ivls : undefined,
  };
};

const buildCensusPayload = async (input: {
  patientId: string;
  parentId: string;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const { companion, parent } = await loadCompanionAndParent({
    patientId: input.patientId,
    parentId: input.parentId,
    parentLastNameError: "Parent last name is required for IDEXX census.",
  });

  const patient = await buildPatientPayload({ companion, parent });

  return {
    patient,
    veterinarian: input.veterinarian ?? undefined,
    ivls: input.ivls ?? undefined,
  };
};

const resolveOrderParentId = async (
  patientId: string,
  parentId: string | null | undefined,
) => {
  if (parentId) {
    return parentId;
  }

  const parentLink = await prisma.parentPatient.findFirst({
    where: {
      patientId,
      role: "PRIMARY",
      status: "ACTIVE",
    },
  });

  if (!parentLink?.parentId) {
    throw new LabOrderServiceError(
      "Primary parent not found for companion.",
      400,
    );
  }

  return parentLink.parentId;
};

export class IdexxOrderAdapter implements LabOrderAdapter {
  async createOrder(input: LabOrderCreateInput): Promise<LabOrderCreateResult> {
    const patientId = input.patientId;
    const parentId = await resolveOrderParentId(patientId, input.parentId);

    const payload = await buildOrderPayload({
      patientId,
      parentId,
      tests: input.tests,
      modality: input.modality,
      ivls: input.ivls,
      veterinarian: input.veterinarian,
      technician: input.technician,
      notes: input.notes,
      specimenCollectionDate: input.specimenCollectionDate,
    });

    const client = await buildIdexxClient(input.organisationId);

    if (input.modality === "IN_HOUSE") {
      const censusPayload = await buildCensusPayload({
        patientId,
        parentId,
        veterinarian: input.veterinarian,
        ivls: input.ivls,
      });

      try {
        await client.getCensusPatient(patientId);
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response
          ?.status;
        if (status !== 404) {
          throw error;
        }

        try {
          await client.addCensusPatient(censusPayload);
        } catch (addError) {
          const addStatus = (addError as { response?: { status?: number } })
            ?.response?.status;
          if (addStatus !== 409) {
            throw addError;
          }
        }
      }
    }

    const response = await client.createOrder(payload);
    const resp = response as Record<string, unknown>;
    return buildOrderResult(resp, payload);
  }

  async getOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const client = await buildIdexxClient(input.organisationId);

    const response = await client.getOrder(idexxOrderId);
    const resp = response as Record<string, unknown>;
    return buildOrderResult(resp, {}, idexxOrderId);
  }

  async updateOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const patientId = input.patientId;
    const parentId = input.parentId ?? null;

    if (!parentId) {
      throw new LabOrderServiceError(
        "parentId is required to update order.",
        400,
      );
    }

    const payload = await buildOrderPayload({
      patientId,
      parentId,
      tests: input.tests,
      modality: input.modality,
      ivls: input.ivls,
      veterinarian: input.veterinarian,
      technician: input.technician,
      notes: input.notes,
      specimenCollectionDate: input.specimenCollectionDate,
    });

    const client = await buildIdexxClient(input.organisationId);

    const response = await client.updateOrder(idexxOrderId, payload);
    const resp = response as Record<string, unknown>;
    return buildOrderResult(resp, payload, idexxOrderId);
  }

  async cancelOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const client = await buildIdexxClient(input.organisationId);

    const response = await client.cancelOrder(idexxOrderId);
    const resp = response as Record<string, unknown>;
    const statusInfo = normalizeLabStatus(resp.status);

    return {
      requestPayload: {},
      responsePayload: resp,
      idexxOrderId,
      status: statusInfo.status ?? "CANCELLED",
      externalStatus: statusInfo.externalStatus,
    };
  }
}
