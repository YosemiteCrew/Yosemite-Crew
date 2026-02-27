import { Types } from "mongoose";
import CompanionModel from "src/models/companion";
import ParentCompanionModel from "src/models/parent-companion";
import { ParentModel } from "src/models/parent";
import CodeMappingModel from "src/models/code-mapping";
import CodeEntryModel from "src/models/code-entry";
import { IntegrationService } from "src/services/integration.service";
import { IdexxClient } from "src/integrations/idexx/idexx.client";
import type {
  LabOrderAdapter,
  LabOrderCreateInput,
  LabOrderCreateResult,
} from "../types";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { normalizeLabStatus } from "src/labs/status";

const lookupIdexxMapping = async (yosemiteCode: string) => {
  const mapping = await CodeMappingModel.findOne({
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

  const count = await CodeEntryModel.countDocuments({
    system: "IDEXX",
    type: "TEST",
    code: { $in: tests },
    active: true,
  });

  if (count !== tests.length) {
    throw new LabOrderServiceError("One or more test codes are invalid.", 400);
  }
};

const buildOrderPayload = async (input: {
  companionId: Types.ObjectId;
  parentId: Types.ObjectId;
  tests: string[];
  modality?: "IN_HOUSE" | "REFERENCE_LAB";
  ivls?: Array<{ serialNumber: string }>;
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
}) => {
  const companion = await CompanionModel.findById(input.companionId).lean();
  if (!companion) {
    throw new LabOrderServiceError("Companion not found.", 404);
  }

  const parent = await ParentModel.findById(input.parentId).lean();
  if (!parent) {
    throw new LabOrderServiceError("Parent not found.", 404);
  }

  if (!parent.lastName) {
    throw new LabOrderServiceError(
      "Parent last name is required for IDEXX orders.",
      400,
    );
  }

  if (!companion.speciesCode || !companion.breedCode) {
    throw new LabOrderServiceError(
      "Companion speciesCode and breedCode are required.",
      400,
    );
  }

  await validateTestCodes(input.tests);

  const speciesCode = await lookupIdexxMapping(companion.speciesCode);
  const breedCode = await lookupIdexxMapping(companion.breedCode);
  const genderCode = resolveGenderCode(companion.gender, companion.isNeutered);

  if (input.modality === "IN_HOUSE") {
    if (!input.ivls || input.ivls.length === 0) {
      throw new LabOrderServiceError(
        "ivls is required for IN_HOUSE orders.",
        400,
      );
    }
  }

  const patient = {
    patientId: companion._id.toString(),
    name: companion.name,
    microchip: companion.microchipNumber ?? undefined,
    speciesCode,
    breedCode,
    genderCode,
    birthdate: companion.dateOfBirth
      ? companion.dateOfBirth.toISOString().split("T")[0]
      : undefined,
    client: {
      id: parent._id.toString(),
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
  };

  if (input.modality === "IN_HOUSE") {
    if (!input.ivls || input.ivls.length === 0) {
      throw new LabOrderServiceError(
        "ivls is required for IN_HOUSE orders.",
        400,
      );
    }
  }

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
  companionId: Types.ObjectId;
  parentId: Types.ObjectId;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const companion = await CompanionModel.findById(input.companionId).lean();
  if (!companion) {
    throw new LabOrderServiceError("Companion not found.", 404);
  }

  const parent = await ParentModel.findById(input.parentId).lean();
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
  const genderCode = resolveGenderCode(companion.gender, companion.isNeutered);

  return {
    patient: {
      patientId: companion._id.toString(),
      name: companion.name,
      microchip: companion.microchipNumber ?? undefined,
      speciesCode,
      breedCode,
      genderCode,
      birthdate: companion.dateOfBirth
        ? companion.dateOfBirth.toISOString().split("T")[0]
        : undefined,
      client: {
        id: parent._id.toString(),
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

export class IdexxOrderAdapter implements LabOrderAdapter {
  async createOrder(input: LabOrderCreateInput): Promise<LabOrderCreateResult> {
    const companionId = new Types.ObjectId(input.companionId);
    let parentId = input.parentId
      ? new Types.ObjectId(input.parentId)
      : null;

    if (!parentId) {
      const parentLink = await ParentCompanionModel.findOne({
        companionId,
        role: "PRIMARY",
        status: "ACTIVE",
      }).lean();

      if (!parentLink?.parentId) {
        throw new LabOrderServiceError(
          "Primary parent not found for companion.",
          400,
        );
      }

      parentId = parentLink.parentId;
    }

    const payload = await buildOrderPayload({
      companionId,
      parentId,
      tests: input.tests,
      modality: input.modality,
      ivls: input.ivls,
      veterinarian: input.veterinarian,
      technician: input.technician,
      notes: input.notes,
      specimenCollectionDate: input.specimenCollectionDate,
    });

    const account = await IntegrationService.requireAccount(
      input.organisationId,
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

    const client = new IdexxClient({
      username: credentials.username,
      password: credentials.password,
      labAccountId: credentials.labAccountId,
      pimsId,
      pimsVersion,
    });

    if (input.modality === "IN_HOUSE") {
      const censusPayload = await buildCensusPayload({
        companionId,
        parentId,
        veterinarian: input.veterinarian,
        ivls: input.ivls,
      });

      const patientId = companionId.toString();
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
    const statusInfo = normalizeLabStatus(resp.status);

    return {
      requestPayload: payload as Record<string, unknown>,
      responsePayload: resp,
      idexxOrderId: coerceString(resp.idexxOrderId),
      uiUrl: (resp.uiURL as string) ?? null,
      pdfUrl: (resp.pdfURL as string) ?? null,
      status: statusInfo.status ?? undefined,
      externalStatus: statusInfo.externalStatus,
    };
  }

  async getOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const account = await IntegrationService.requireAccount(
      input.organisationId,
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

    const client = new IdexxClient({
      username: credentials.username,
      password: credentials.password,
      labAccountId: credentials.labAccountId,
      pimsId,
      pimsVersion,
    });

    const response = await client.getOrder(idexxOrderId);
    const resp = response as Record<string, unknown>;
    const statusInfo = normalizeLabStatus(resp.status);

    return {
      requestPayload: {},
      responsePayload: resp,
      idexxOrderId: idexxOrderId,
      uiUrl: (resp.uiURL as string) ?? null,
      pdfUrl: (resp.pdfURL as string) ?? null,
      status: statusInfo.status ?? undefined,
      externalStatus: statusInfo.externalStatus,
    };
  }

  async updateOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const companionId = new Types.ObjectId(input.companionId);
    const parentId = input.parentId
      ? new Types.ObjectId(input.parentId)
      : null;

    if (!parentId) {
      throw new LabOrderServiceError(
        "parentId is required to update order.",
        400,
      );
    }

    const payload = await buildOrderPayload({
      companionId,
      parentId,
      tests: input.tests,
      modality: input.modality,
      ivls: input.ivls,
      veterinarian: input.veterinarian,
      technician: input.technician,
      notes: input.notes,
      specimenCollectionDate: input.specimenCollectionDate,
    });

    const account = await IntegrationService.requireAccount(
      input.organisationId,
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

    const client = new IdexxClient({
      username: credentials.username,
      password: credentials.password,
      labAccountId: credentials.labAccountId,
      pimsId,
      pimsVersion,
    });

    const response = await client.updateOrder(idexxOrderId, payload);
    const resp = response as Record<string, unknown>;
    const statusInfo = normalizeLabStatus(resp.status);

    return {
      requestPayload: payload as Record<string, unknown>,
      responsePayload: resp,
      idexxOrderId,
      uiUrl: (resp.uiURL as string) ?? null,
      pdfUrl: (resp.pdfURL as string) ?? null,
      status: statusInfo.status ?? undefined,
      externalStatus: statusInfo.externalStatus,
    };
  }

  async cancelOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const account = await IntegrationService.requireAccount(
      input.organisationId,
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

    const client = new IdexxClient({
      username: credentials.username,
      password: credentials.password,
      labAccountId: credentials.labAccountId,
      pimsId,
      pimsVersion,
    });

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
