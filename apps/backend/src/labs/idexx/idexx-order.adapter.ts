import { Types } from "mongoose";
import CompanionModel from "src/models/companion";
import ParentCompanionModel from "src/models/parent-companion";
import { ParentModel } from "src/models/parent";
import CodeMappingModel from "src/models/code-mapping";
import CodeEntryModel from "src/models/code-entry";
import { IntegrationService } from "src/services/integration.service";
import { IdexxClient } from "src/integrations/idexx/idexx.client";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import type {
  LabOrderAdapter,
  LabOrderCreateInput,
  LabOrderCreateResult,
} from "../types";
import { LabOrderServiceError } from "src/services/lab-order.service";
import { normalizeLabStatus } from "src/labs/status";

type IdLike = Types.ObjectId | string;

const toIdString = (value: IdLike) =>
  typeof value === "string" ? value : value.toString();

const resolveDocId = (doc: { id?: string; _id?: { toString(): string } }) => {
  if ("id" in doc && typeof doc.id === "string") return doc.id;
  if ("_id" in doc && doc._id) return doc._id.toString();
  throw new LabOrderServiceError("Missing document id.", 500);
};

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

const requireIdexxClient = async (organisationId: string) => {
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

const validateTestCodes = async (tests: string[]) => {
  if (!tests.length) {
    throw new LabOrderServiceError("tests are required.", 400);
  }

  const count = isReadFromPostgres()
    ? await prisma.codeEntry.count({
        where: {
          system: "IDEXX",
          type: "TEST",
          code: { in: tests },
          active: true,
        },
      })
    : await CodeEntryModel.countDocuments({
        system: "IDEXX",
        type: "TEST",
        code: { $in: tests },
        active: true,
      });

  if (count !== tests.length) {
    throw new LabOrderServiceError("One or more test codes are invalid.", 400);
  }
};

const loadCompanionAndParent = async (input: {
  companionId: IdLike;
  parentId: IdLike;
  parentLastNameError: string;
}) => {
  const companion = isReadFromPostgres()
    ? await prisma.companion.findFirst({
        where: { id: toIdString(input.companionId) },
      })
    : await CompanionModel.findById(input.companionId).lean();
  if (!companion) {
    throw new LabOrderServiceError("Companion not found.", 404);
  }

  const parent = isReadFromPostgres()
    ? await prisma.parent.findFirst({
        where: { id: toIdString(input.parentId) },
        include: { address: true },
      })
    : await ParentModel.findById(input.parentId).lean();
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
    name?: string;
    gender?: string | null;
    isNeutered?: boolean | null;
    speciesCode?: string | null;
    breedCode?: string | null;
    microchipNumber?: string | null;
    dateOfBirth?: Date | null;
  } & { id?: string; _id?: { toString(): string } };
  parent: {
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
  } & { id?: string; _id?: { toString(): string } };
}) => {
  const speciesCode = await lookupIdexxMapping(
    input.companion.speciesCode as string,
  );
  const breedCode = await lookupIdexxMapping(
    input.companion.breedCode as string,
  );
  const genderCode = resolveGenderCode(
    input.companion.gender as string,
    input.companion.isNeutered ?? undefined,
  );

  return {
    patientId: resolveDocId(input.companion),
    name: input.companion.name,
    microchip: input.companion.microchipNumber ?? undefined,
    speciesCode,
    breedCode,
    genderCode,
    birthdate: input.companion.dateOfBirth
      ? input.companion.dateOfBirth.toISOString().split("T")[0]
      : undefined,
    client: {
      id: resolveDocId(input.parent),
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
  companionId: IdLike;
  parentId: IdLike;
  tests: string[];
  modality?: "IN_HOUSE" | "REFERENCE_LAB";
  ivls?: Array<{ serialNumber: string }>;
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
}) => {
  const { companion, parent } = await loadCompanionAndParent({
    companionId: input.companionId,
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
  companionId: IdLike;
  parentId: IdLike;
  veterinarian?: string | null;
  ivls?: Array<{ serialNumber: string }>;
}) => {
  const { companion, parent } = await loadCompanionAndParent({
    companionId: input.companionId,
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

export class IdexxOrderAdapter implements LabOrderAdapter {
  async createOrder(input: LabOrderCreateInput): Promise<LabOrderCreateResult> {
    const companionId = isReadFromPostgres()
      ? input.companionId
      : new Types.ObjectId(input.companionId);
    let parentId = input.parentId
      ? isReadFromPostgres()
        ? input.parentId
        : new Types.ObjectId(input.parentId)
      : null;

    if (!parentId) {
      const parentLink = isReadFromPostgres()
        ? await prisma.parentCompanion.findFirst({
            where: {
              companionId: toIdString(companionId),
              role: "PRIMARY",
              status: "ACTIVE",
            },
          })
        : await ParentCompanionModel.findOne({
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

      parentId = parentLink.parentId as IdLike;
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

    const client = await requireIdexxClient(input.organisationId);

    if (input.modality === "IN_HOUSE") {
      const censusPayload = await buildCensusPayload({
        companionId,
        parentId,
        veterinarian: input.veterinarian,
        ivls: input.ivls,
      });

      const patientId = toIdString(companionId);
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
    return buildOrderResult(resp, payload as Record<string, unknown>);
  }

  async getOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const client = await requireIdexxClient(input.organisationId);

    const response = await client.getOrder(idexxOrderId);
    const resp = response as Record<string, unknown>;
    return buildOrderResult(resp, {}, idexxOrderId);
  }

  async updateOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const companionId = isReadFromPostgres()
      ? input.companionId
      : new Types.ObjectId(input.companionId);
    const parentId = input.parentId
      ? isReadFromPostgres()
        ? input.parentId
        : new Types.ObjectId(input.parentId)
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

    const client = await requireIdexxClient(input.organisationId);

    const response = await client.updateOrder(idexxOrderId, payload);
    const resp = response as Record<string, unknown>;
    return buildOrderResult(
      resp,
      payload as Record<string, unknown>,
      idexxOrderId,
    );
  }

  async cancelOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult> {
    const client = await requireIdexxClient(input.organisationId);

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
