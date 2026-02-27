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

const ensureTestsProvided = (tests: string[] | undefined | null) => {
  if (!tests || tests.length === 0) {
    throw new LabOrderServiceError("tests are required.", 400);
  }
};

const resolvePrimaryParentId = async (companionId: Types.ObjectId) => {
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

  return parentLink.parentId;
};

const syncLabOrderToPostgres = async (doc: LabOrderDocument) => {
  if (!shouldDualWrite) return;
  try {
    const toJsonInput = (
      value: Record<string, unknown> | null | undefined,
    ) => {
      if (value === null) return Prisma.JsonNull;
      if (value === undefined) return undefined;
      return value as Prisma.InputJsonValue;
    };

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
        ivls:
          doc.ivls === null ? Prisma.JsonNull : (doc.ivls ?? undefined),
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
        ivls:
          doc.ivls === null ? Prisma.JsonNull : (doc.ivls ?? undefined),
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

  const entries = await CodeEntryModel.find({
    system: "IDEXX",
    type: "TEST",
    code: { $in: testCodes },
    active: true,
  }).lean();

  const entryByCode = new Map(entries.map((entry) => [entry.code, entry]));

    return testCodes.map((code) => {
    const entry = entryByCode.get(code);
    const display = entry?.display ?? `IDEXX Test ${code}`;
    const listPrice = toNumber((entry?.meta as Record<string, unknown>)?.listPrice);
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
    params: { query?: string; limit?: number; codes?: string[] },
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
      filter.$or = [
        { code: new RegExp(params.query, "i") },
        { display: new RegExp(params.query, "i") },
        { synonyms: new RegExp(params.query, "i") },
      ];
    }

    const cursor = CodeEntryModel.find(filter)
      .sort({ display: 1 })
      .select({ system: 1, code: 1, display: 1, type: 1, meta: 1 });

    if (params.limit && params.limit > 0) {
      cursor.limit(params.limit);
    }

    return cursor.lean();
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
    const companionId = new Types.ObjectId(input.companionId);
    const resolvedParentId =
      input.parentId ? new Types.ObjectId(input.parentId) : null;
    const parentId = resolvedParentId ?? (await resolvePrimaryParentId(companionId));
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

    const adapter = getLabOrderAdapter(provider);

    const existing = await LabOrderModel.findOne({
      organisationId,
      provider,
      idexxOrderId,
    });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const result = await adapter.getOrder(idexxOrderId, {
      organisationId,
      companionId: existing.companionId.toString(),
      parentId: existing.parentId.toString(),
      tests: existing.tests,
      modality: existing.modality ?? undefined,
      ivls: existing.ivls ?? undefined,
    });

    if (result.status) {
      existing.status = result.status as LabOrderStatus;
    }
    existing.externalStatus = result.externalStatus ?? existing.externalStatus ?? null;
    existing.uiUrl = result.uiUrl ?? existing.uiUrl ?? null;
    existing.pdfUrl = result.pdfUrl ?? existing.pdfUrl ?? null;
    existing.responsePayload = result.responsePayload ?? existing.responsePayload ?? null;
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

    const existing = await LabOrderModel.findOne({
      organisationId,
      provider,
      idexxOrderId,
    });

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
      organisationId,
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
    existing.externalStatus = result.externalStatus ?? existing.externalStatus ?? null;
    existing.uiUrl = result.uiUrl ?? existing.uiUrl ?? null;
    existing.pdfUrl = result.pdfUrl ?? existing.pdfUrl ?? null;
    existing.requestPayload = result.requestPayload ?? existing.requestPayload ?? null;
    existing.responsePayload = result.responsePayload ?? existing.responsePayload ?? null;
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

    const existing = await LabOrderModel.findOne({
      organisationId,
      provider,
      idexxOrderId,
    });

    if (!existing) {
      throw new LabOrderServiceError("Lab order not found.", 404);
    }

    const adapter = getLabOrderAdapter(provider);
    const result = await adapter.cancelOrder(idexxOrderId, {
      organisationId,
      companionId: existing.companionId.toString(),
      parentId: existing.parentId.toString(),
      tests: existing.tests,
      modality: existing.modality ?? undefined,
      ivls: existing.ivls ?? undefined,
    });

    existing.status = (result.status as LabOrderStatus) ?? "CANCELLED";
    existing.externalStatus = result.externalStatus ?? existing.externalStatus ?? null;
    existing.responsePayload = result.responsePayload ?? existing.responsePayload ?? null;
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
};
