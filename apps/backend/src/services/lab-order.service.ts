import { Types } from "mongoose";
import LabOrderModel, {
  type LabOrderDocument,
  type LabOrderStatus,
} from "src/models/lab-order";
import { prisma } from "src/config/prisma";
import { getLabOrderAdapter, normalizeLabProvider } from "src/labs";
import type { LabOrderCreateInput, LabOrderUpdateInput } from "src/labs";
import logger from "src/utils/logger";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma } from "@prisma/client";
import ParentCompanionModel from "src/models/parent-companion";
import CodeEntryModel from "src/models/code-entry";
import { InvoiceService } from "src/services/invoice.service";
import type { InvoiceItem } from "@yosemite-crew/types";
import { isReadFromPostgres } from "src/config/read-switch";

export class LabOrderServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "LabOrderServiceError";
  }
}

const ensureNonEmpty = (value: string | undefined, field: string) => {
  if (!value?.trim()) {
    throw new LabOrderServiceError(`${field} is required.`, 400);
  }
};

const ensureNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new LabOrderServiceError(`${field} is required.`, 400);
  }
  return value;
};

const ensureOptionalString = (
  value: unknown,
  field: string,
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return value;
};

const ensureOptionalObjectIdString = (
  value: unknown,
  field: string,
): string | undefined => {
  const asString = ensureOptionalString(value, field);
  if (!asString) return undefined;
  if (!Types.ObjectId.isValid(asString)) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return asString;
};

const LAB_ORDER_STATUS_VALUES = new Set<LabOrderStatus>([
  "CREATED",
  "SUBMITTED",
  "AT_THE_LAB",
  "PARTIAL",
  "RUNNING",
  "COMPLETE",
  "CANCELLED",
  "ERROR",
]);

const ensureOptionalStatus = (value: unknown): LabOrderStatus | undefined => {
  const asString = ensureOptionalString(value, "status");
  if (!asString) return undefined;
  if (!LAB_ORDER_STATUS_VALUES.has(asString as LabOrderStatus)) {
    throw new LabOrderServiceError("Invalid status.", 400);
  }
  return asString as LabOrderStatus;
};

const ensureTestsProvided = (tests: string[] | undefined | null) => {
  if (!tests || tests.length === 0) {
    throw new LabOrderServiceError("tests are required.", 400);
  }
};

const toJsonInput = (
  value: Record<string, unknown> | unknown[] | null | undefined,
) => {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
};

type IdLike = Types.ObjectId | string;

const toIdString = (value: IdLike) =>
  typeof value === "string" ? value : value.toString();

const ensureObjectIdLike = (value: IdLike, field: string): Types.ObjectId => {
  if (value instanceof Types.ObjectId) {
    return value;
  }
  if (!Types.ObjectId.isValid(value)) {
    throw new LabOrderServiceError(`Invalid ${field}.`, 400);
  }
  return new Types.ObjectId(value);
};

const resolvePrimaryParentId = async (companionId: IdLike) => {
  const safeCompanionId = ensureObjectIdLike(companionId, "companionId");
  const parentLink = isReadFromPostgres()
    ? await prisma.parentCompanion.findFirst({
        where: {
          companionId: safeCompanionId.toString(),
          role: "PRIMARY",
          status: "ACTIVE",
        },
      })
    : await ParentCompanionModel.findOne({
        companionId: safeCompanionId,
        role: "PRIMARY",
        status: "ACTIVE",
      })
        .setOptions({ sanitizeFilter: true })
        .lean();

  if (!parentLink?.parentId) {
    throw new LabOrderServiceError(
      "Primary parent not found for companion.",
      400,
    );
  }

  return parentLink.parentId;
};

const syncLabOrderToPostgres = async (doc: LabOrderDocument) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.labOrder.upsert({
      where: { id: doc._id.toString() },
      create: {
        id: doc._id.toString(),
        organisationId: doc.organisationId,
        provider: doc.provider,
        companionId: doc.companionId.toString(),
        parentId: doc.parentId.toString(),
        appointmentId: doc.appointmentId?.toString() ?? null,
        createdByUserId: doc.createdByUserId ?? null,
        status: doc.status,
        idexxOrderId: doc.idexxOrderId ?? null,
        uiUrl: doc.uiUrl ?? null,
        pdfUrl: doc.pdfUrl ?? null,
        tests: doc.tests as unknown as Prisma.InputJsonValue,
        modality: doc.modality ?? undefined,
        veterinarian: doc.veterinarian ?? null,
        technician: doc.technician ?? null,
        notes: doc.notes ?? null,
        specimenCollectionDate: doc.specimenCollectionDate ?? null,
        ivls: doc.ivls === null ? Prisma.JsonNull : (doc.ivls ?? undefined),
        requestPayload: toJsonInput(doc.requestPayload),
        responsePayload: toJsonInput(doc.responsePayload),
        error: doc.error ?? null,
        externalStatus: doc.externalStatus ?? null,
        invoiceId: doc.invoiceId ?? null,
        billedAt: doc.billedAt ?? null,
        billingError: doc.billingError ?? null,
      },
      update: {
        status: doc.status,
        idexxOrderId: doc.idexxOrderId ?? null,
        uiUrl: doc.uiUrl ?? null,
        pdfUrl: doc.pdfUrl ?? null,
        tests: doc.tests as unknown as Prisma.InputJsonValue,
        appointmentId: doc.appointmentId?.toString() ?? null,
        modality: doc.modality ?? undefined,
        veterinarian: doc.veterinarian ?? null,
        technician: doc.technician ?? null,
        notes: doc.notes ?? null,
        specimenCollectionDate: doc.specimenCollectionDate ?? null,
        ivls: doc.ivls === null ? Prisma.JsonNull : (doc.ivls ?? undefined),
        requestPayload: toJsonInput(doc.requestPayload),
        responsePayload: toJsonInput(doc.responsePayload),
        error: doc.error ?? null,
        externalStatus: doc.externalStatus ?? null,
        invoiceId: doc.invoiceId ?? null,
        billedAt: doc.billedAt ?? null,
        billingError: doc.billingError ?? null,
      },
    });
  } catch (err) {
    handleDualWriteError("LabOrder", err);
  }
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const buildInvoiceItemsFromTests = async (
  testCodes: string[],
): Promise<InvoiceItem[]> => {
  if (!testCodes.length) return [];

  const entries = isReadFromPostgres()
    ? await prisma.codeEntry.findMany({
        where: {
          system: "IDEXX",
          type: "TEST",
          code: { in: testCodes },
          active: true,
        },
      })
    : await CodeEntryModel.find({
        system: "IDEXX",
        type: "TEST",
        code: { $in: testCodes },
        active: true,
      }).lean();

  const entryByCode = new Map(entries.map((entry) => [entry.code, entry]));

  return testCodes.map((code) => {
    const entry = entryByCode.get(code);
    const display = entry?.display ?? `IDEXX Test ${code}`;
    const listPrice = toNumber(
      (entry?.meta as Record<string, unknown>)?.listPrice,
    );
    if (listPrice === null) {
      throw new LabOrderServiceError(
        `Missing list price for IDEXX test ${code}.`,
        422,
      );
    }

    return {
      id: `laborder:test:${code}`,
      name: display,
      description: `IDEXX test ${code}`,
      quantity: 1,
      unitPrice: listPrice,
      total: listPrice,
    };
  });
};

const maybeBillSubmittedOrder = async (order: LabOrderDocument) => {
  if (order.status !== "SUBMITTED") return;
  if (order.billedAt) return;
  if (!order.appointmentId) {
    logger.warn("Lab order billing skipped: missing appointmentId.", {
      labOrderId: order._id.toString(),
    });
    return;
  }

  try {
    const items = await buildInvoiceItemsFromTests(order.tests);
    if (!items.length) {
      throw new LabOrderServiceError(
        "No billable lab tests found for this order.",
        422,
      );
    }

    const invoice = await InvoiceService.addChargesToAppointment(
      order.appointmentId.toString(),
      items,
    );

    order.invoiceId = invoice.id;
    order.billedAt = new Date();
    order.billingError = null;
    await order.save();
    await syncLabOrderToPostgres(order);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lab order billing failed.";
    order.billingError = message;
    await order.save();
    await syncLabOrderToPostgres(order);
    logger.error("Lab order billing failed", error);
  }
};

export const LabOrderService = {
  async listProviderTests(
    providerInput: string,
    params: { query?: string; limit?: number; page?: number; codes?: string[] },
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const filter: Record<string, unknown> = {
      system: "IDEXX",
      type: "TEST",
      active: true,
    };

    if (params.codes && params.codes.length > 0) {
      filter.code = { $in: params.codes };
    }

    if (params.query) {
      if (typeof params.query !== "string") {
        throw new LabOrderServiceError("Invalid query.", 400);
      }
      const trimmedQuery = params.query.trim();
      if (trimmedQuery) {
        const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { code: new RegExp(escaped, "i") },
          { display: new RegExp(escaped, "i") },
          { synonyms: new RegExp(escaped, "i") },
        ];
      }
    }

    const limit =
      typeof params.limit === "number" && params.limit > 0
        ? Math.min(params.limit, 200)
        : 50;
    const page =
      typeof params.page === "number" && params.page > 0 ? params.page : 1;
    const skip = (page - 1) * limit;

    const [total, items] = isReadFromPostgres()
      ? await Promise.all([
          prisma.codeEntry.count({
            where: {
              system: "IDEXX",
              type: "TEST",
              active: true,
              ...(params.codes && params.codes.length > 0
                ? { code: { in: params.codes } }
                : {}),
              ...(params.query && params.query.trim()
                ? {
                    OR: [
                      {
                        code: {
                          contains: params.query.trim(),
                          mode: "insensitive",
                        },
                      },
                      {
                        display: {
                          contains: params.query.trim(),
                          mode: "insensitive",
                        },
                      },
                    ],
                  }
                : {}),
            },
          }),
          prisma.codeEntry.findMany({
            where: {
              system: "IDEXX",
              type: "TEST",
              active: true,
              ...(params.codes && params.codes.length > 0
                ? { code: { in: params.codes } }
                : {}),
              ...(params.query && params.query.trim()
                ? {
                    OR: [
                      {
                        code: {
                          contains: params.query.trim(),
                          mode: "insensitive",
                        },
                      },
                      {
                        display: {
                          contains: params.query.trim(),
                          mode: "insensitive",
                        },
                      },
                    ],
                  }
                : {}),
            },
            orderBy: { display: "asc" },
            skip,
            take: limit,
            select: {
              system: true,
              code: true,
              display: true,
              type: true,
              meta: true,
            },
          }),
        ])
      : await Promise.all([
          CodeEntryModel.countDocuments(filter).setOptions({
            sanitizeFilter: true,
          }),
          CodeEntryModel.find(filter)
            .sort({ display: 1 })
            .skip(skip)
            .limit(limit)
            .setOptions({ sanitizeFilter: true })
            .select({ system: 1, code: 1, display: 1, type: 1, meta: 1 })
            .lean(),
        ]);

    return { total, page, limit, tests: items };
  },
  async createOrder(providerInput: string, input: LabOrderCreateInput) {
    ensureNonEmpty(input.organisationId, "organisationId");
    ensureNonEmpty(input.companionId, "companionId");
    ensureTestsProvided(input.tests);

    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }

    const adapter = getLabOrderAdapter(provider);
    if (isReadFromPostgres()) {
      const parentId =
        input.parentId ?? (await resolvePrimaryParentId(input.companionId));
      const appointmentId = input.appointmentId ?? null;

      const labOrder = await prisma.labOrder.create({
        data: {
          organisationId: input.organisationId,
          provider,
          companionId: input.companionId,
          parentId: toIdString(parentId),
          appointmentId,
          createdByUserId: input.createdByUserId ?? null,
          status: "CREATED",
          modality: input.modality ?? "REFERENCE_LAB",
          tests: toJsonInput(input.tests),
          veterinarian: input.veterinarian ?? null,
          technician: input.technician ?? null,
          notes: input.notes ?? null,
          specimenCollectionDate: input.specimenCollectionDate ?? null,
          ivls: toJsonInput(input.ivls),
          requestPayload: undefined,
          responsePayload: undefined,
          invoiceId: null,
          billedAt: null,
          billingError: null,
        },
      });

      try {
        const result = await adapter.createOrder({
          ...input,
          parentId: toIdString(parentId),
        });

        const updated = await prisma.labOrder.update({
          where: { id: labOrder.id },
          data: {
            idexxOrderId: result.idexxOrderId ?? null,
            uiUrl: result.uiUrl ?? null,
            pdfUrl: result.pdfUrl ?? null,
            status: (result.status as LabOrderStatus) ?? labOrder.status,
            externalStatus: result.externalStatus ?? null,
            requestPayload: toJsonInput(result.requestPayload),
            responsePayload: toJsonInput(result.responsePayload),
            modality: input.modality ?? labOrder.modality,
            ivls: toJsonInput(input.ivls),
          },
        });

        if (
          updated.status === "SUBMITTED" &&
          !updated.billedAt &&
          updated.appointmentId
        ) {
          try {
            const items = await buildInvoiceItemsFromTests(
              (updated.tests as string[]) ?? [],
            );
            const invoice = await InvoiceService.addChargesToAppointment(
              updated.appointmentId,
              items,
            );
            await prisma.labOrder.update({
              where: { id: updated.id },
              data: {
                invoiceId: invoice.id,
                billedAt: new Date(),
                billingError: null,
              },
            });
          } catch (billingError) {
            const message =
              billingError instanceof Error
                ? billingError.message
                : "Lab order billing failed.";
            await prisma.labOrder.update({
              where: { id: updated.id },
              data: { billingError: message },
            });
          }
        }

        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Order creation failed.";
        await prisma.labOrder.update({
          where: { id: labOrder.id },
          data: { status: "ERROR", error: message },
        });

        logger.error("Lab order creation failed", error);
        throw new LabOrderServiceError("Lab order creation failed.", 502);
      }
    }

    const companionId = new Types.ObjectId(input.companionId);
    const resolvedParentId = input.parentId
      ? new Types.ObjectId(input.parentId)
      : null;
    const parentId =
      resolvedParentId ?? (await resolvePrimaryParentId(companionId));
    const appointmentId =
      input.appointmentId && Types.ObjectId.isValid(input.appointmentId)
        ? new Types.ObjectId(input.appointmentId)
        : input.appointmentId
          ? (() => {
              throw new LabOrderServiceError("Invalid appointmentId.", 400);
            })()
          : null;

    const labOrderDoc = await LabOrderModel.create({
      organisationId: input.organisationId,
      provider,
      companionId,
      parentId,
      appointmentId,
      createdByUserId: input.createdByUserId ?? null,
      status: "CREATED",
      modality: input.modality ?? "REFERENCE_LAB",
      tests: input.tests,
      veterinarian: input.veterinarian ?? null,
      technician: input.technician ?? null,
      notes: input.notes ?? null,
      specimenCollectionDate: input.specimenCollectionDate ?? null,
      ivls: input.ivls ?? null,
      requestPayload: null,
      invoiceId: null,
      billedAt: null,
      billingError: null,
    });

    try {
      const result = await adapter.createOrder({
        ...input,
        parentId: parentId.toString(),
      });

      labOrderDoc.idexxOrderId = result.idexxOrderId ?? null;
      labOrderDoc.uiUrl = result.uiUrl ?? null;
      labOrderDoc.pdfUrl = result.pdfUrl ?? null;
      labOrderDoc.status =
        (result.status as LabOrderStatus) ?? labOrderDoc.status;
      labOrderDoc.externalStatus = result.externalStatus ?? null;
      labOrderDoc.requestPayload = result.requestPayload ?? null;
      labOrderDoc.responsePayload = result.responsePayload ?? null;
      labOrderDoc.modality = input.modality ?? labOrderDoc.modality;
      labOrderDoc.ivls = input.ivls ?? labOrderDoc.ivls;
      await labOrderDoc.save();
      await syncLabOrderToPostgres(labOrderDoc);
      await maybeBillSubmittedOrder(labOrderDoc);

      return labOrderDoc.toObject();
    } catch (error) {
      labOrderDoc.status = "ERROR";
      labOrderDoc.error =
        error instanceof Error ? error.message : "Order creation failed.";
      await labOrderDoc.save();
      await syncLabOrderToPostgres(labOrderDoc);

      logger.error("Lab order creation failed", error);
      throw new LabOrderServiceError("Lab order creation failed.", 502);
    }
  },

  async getOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const adapter = getLabOrderAdapter(provider);

    if (isReadFromPostgres()) {
      const existing = await prisma.labOrder.findFirst({
        where: {
          organisationId: safeOrganisationId,
          provider,
          idexxOrderId: safeIdexxOrderId,
        },
      });

      if (!existing) {
        throw new LabOrderServiceError("Lab order not found.", 404);
      }

      const tests = Array.isArray(existing.tests)
        ? (existing.tests as string[])
        : [];
      const ivls = Array.isArray(existing.ivls)
        ? (existing.ivls as Array<{ serialNumber: string }>)
        : undefined;

      const result = await adapter.getOrder(idexxOrderId, {
        organisationId: safeOrganisationId,
        companionId: existing.companionId,
        parentId: existing.parentId,
        tests,
        modality: existing.modality ?? undefined,
        ivls,
      });

      const updated = await prisma.labOrder.update({
        where: { id: existing.id },
        data: {
          status: (result.status as LabOrderStatus) ?? existing.status,
          externalStatus:
            result.externalStatus ?? existing.externalStatus ?? null,
          uiUrl: result.uiUrl ?? existing.uiUrl ?? null,
          pdfUrl: result.pdfUrl ?? existing.pdfUrl ?? null,
          responsePayload: toJsonInput(result.responsePayload),
        },
      });
      return updated;
    }

    const existing = await LabOrderModel.findOne({
      organisationId: safeOrganisationId,
      provider,
      idexxOrderId: safeIdexxOrderId,
    }).setOptions({ sanitizeFilter: true });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const tests = Array.isArray(existing.tests) ? existing.tests : [];
    const ivls = Array.isArray(existing.ivls) ? existing.ivls : undefined;

    const result = await adapter.getOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      companionId: existing.companionId.toString(),
      parentId: existing.parentId.toString(),
      tests,
      modality: existing.modality ?? undefined,
      ivls,
    });

    if (result.status) {
      existing.status = result.status as LabOrderStatus;
    }
    existing.externalStatus =
      result.externalStatus ?? existing.externalStatus ?? null;
    existing.uiUrl = result.uiUrl ?? existing.uiUrl ?? null;
    existing.pdfUrl = result.pdfUrl ?? existing.pdfUrl ?? null;
    existing.responsePayload =
      result.responsePayload ?? existing.responsePayload ?? null;
    await existing.save();
    await syncLabOrderToPostgres(existing);
    await maybeBillSubmittedOrder(existing);

    return existing.toObject();
  },

  async updateOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
    input: LabOrderUpdateInput,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const existing = await LabOrderModel.findOne({
      organisationId: safeOrganisationId,
      provider,
      idexxOrderId: safeIdexxOrderId,
    }).setOptions({ sanitizeFilter: true });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    if (existing.status !== "CREATED") {
      throw new LabOrderServiceError(
        "Only CREATED orders can be updated.",
        400,
      );
    }
    if (input.tests && input.tests.length === 0) {
      throw new LabOrderServiceError("tests are required.", 400);
    }

    const adapter = getLabOrderAdapter(provider);
    const result = await adapter.updateOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      companionId: existing.companionId.toString(),
      parentId: existing.parentId.toString(),
      tests: input.tests ?? existing.tests,
      modality: input.modality ?? existing.modality ?? undefined,
      ivls: input.ivls ?? existing.ivls ?? undefined,
      veterinarian: input.veterinarian ?? existing.veterinarian ?? null,
      technician: input.technician ?? existing.technician ?? null,
      notes: input.notes ?? existing.notes ?? null,
      specimenCollectionDate:
        input.specimenCollectionDate ?? existing.specimenCollectionDate ?? null,
    });

    if (result.status) {
      existing.status = result.status as LabOrderStatus;
    }
    existing.externalStatus =
      result.externalStatus ?? existing.externalStatus ?? null;
    existing.uiUrl = result.uiUrl ?? existing.uiUrl ?? null;
    existing.pdfUrl = result.pdfUrl ?? existing.pdfUrl ?? null;
    existing.requestPayload =
      result.requestPayload ?? existing.requestPayload ?? null;
    existing.responsePayload =
      result.responsePayload ?? existing.responsePayload ?? null;
    existing.tests = input.tests ?? existing.tests;
    existing.modality = input.modality ?? existing.modality ?? null;
    existing.ivls = input.ivls ?? existing.ivls ?? null;
    existing.veterinarian = input.veterinarian ?? existing.veterinarian ?? null;
    existing.technician = input.technician ?? existing.technician ?? null;
    existing.notes = input.notes ?? existing.notes ?? null;
    existing.specimenCollectionDate =
      input.specimenCollectionDate ?? existing.specimenCollectionDate ?? null;
    await existing.save();
    await syncLabOrderToPostgres(existing);

    return existing.toObject();
  },

  async cancelOrder(
    providerInput: string,
    organisationId: string,
    idexxOrderId: string,
  ) {
    const provider = normalizeLabProvider(providerInput);
    if (!provider) {
      throw new LabOrderServiceError("Unsupported lab provider.", 400);
    }
    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeIdexxOrderId = ensureNonEmptyString(idexxOrderId, "idexxOrderId");

    const existing = await LabOrderModel.findOne({
      organisationId: safeOrganisationId,
      provider,
      idexxOrderId: safeIdexxOrderId,
    }).setOptions({ sanitizeFilter: true });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const adapter = getLabOrderAdapter(provider);
    const result = await adapter.cancelOrder(idexxOrderId, {
      organisationId: safeOrganisationId,
      companionId: existing.companionId.toString(),
      parentId: existing.parentId.toString(),
      tests: existing.tests,
      modality: existing.modality ?? undefined,
      ivls: existing.ivls ?? undefined,
    });

    existing.status = (result.status as LabOrderStatus) ?? "CANCELLED";
    existing.externalStatus =
      result.externalStatus ?? existing.externalStatus ?? null;
    existing.responsePayload =
      result.responsePayload ?? existing.responsePayload ?? null;
    await existing.save();
    await syncLabOrderToPostgres(existing);
    if (existing.invoiceId) {
      try {
        await InvoiceService.handleInvoiceCancellation(
          existing.invoiceId,
          "Lab order cancelled",
        );
      } catch (error) {
        logger.error("Failed to cancel/refund invoice for lab order", error);
      }
    }

    return existing.toObject();
  },

  async listOrders(params: {
    organisationId: string;
    appointmentId?: string;
    companionId?: string;
    provider?: string;
    status?: LabOrderStatus;
    limit?: number;
  }) {
    const {
      organisationId,
      appointmentId,
      companionId,
      provider,
      status,
      limit,
    } = params;

    const safeOrganisationId = ensureNonEmptyString(
      organisationId,
      "organisationId",
    );
    const safeAppointmentId = ensureOptionalObjectIdString(
      appointmentId,
      "appointmentId",
    );
    const safeCompanionId = ensureOptionalObjectIdString(
      companionId,
      "companionId",
    );
    const safeProvider = ensureOptionalString(provider, "provider");
    const safeStatus = ensureOptionalStatus(status);
    const safeLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    const filter: Record<string, unknown> = {
      organisationId: safeOrganisationId,
    };
    if (safeAppointmentId) {
      filter.appointmentId = new Types.ObjectId(safeAppointmentId);
    }
    if (safeCompanionId) {
      filter.companionId = new Types.ObjectId(safeCompanionId);
    }
    if (safeProvider) {
      const normalized = normalizeLabProvider(safeProvider);
      if (!normalized) {
        throw new LabOrderServiceError("Unsupported lab provider.", 400);
      }
      filter.provider = normalized;
    }
    if (safeStatus) filter.status = safeStatus;

    if (isReadFromPostgres()) {
      const where: Prisma.LabOrderWhereInput = {
        organisationId: safeOrganisationId,
      };
      if (safeAppointmentId) where.appointmentId = safeAppointmentId;
      if (safeCompanionId) where.companionId = safeCompanionId;
      if (safeProvider) {
        const normalized = normalizeLabProvider(safeProvider);
        if (!normalized) {
          throw new LabOrderServiceError("Unsupported lab provider.", 400);
        }
        where.provider = normalized;
      }
      if (safeStatus) where.status = safeStatus;

      return prisma.labOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: safeLimit,
      });
    }

    const cursor = LabOrderModel.find(filter)
      .sort({ createdAt: -1 })
      .setOptions({ sanitizeFilter: true })
      .lean();

    if (safeLimit) cursor.limit(safeLimit);

    return cursor.exec();
  },
};
