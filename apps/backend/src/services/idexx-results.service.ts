import { Prisma, type LabOrderStatus } from "@prisma/client";
import { IdexxResultsClient } from "src/integrations/idexx/idexx-results.client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { uploadBufferAsFile } from "src/middlewares/upload";
import { DocumentService } from "src/services/document.service";
import { TaskService } from "src/services/task.service";

type LatestResultsResponse = {
  batchId?: string;
  count?: number;
  hasMoreResults?: boolean;
  timestamp?: string;
  results?: Array<Record<string, unknown>>;
};

type IdexxResult = Record<string, unknown> & {
  patient?: Record<string, unknown>;
};

const toJsonInput = (value: Record<string, unknown> | null | undefined) => {
  if (value === null) return Prisma.JsonNull;
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
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

const coerceStringOrEmpty = (value: unknown): string =>
  coerceString(value) ?? "";

/**
 * `organisationId` is the tenant key that lab-result reads authorize on, so it is taken from
 * the LabOrder we placed rather than from the provider's response, which is outside our
 * trust boundary and may omit or misstate it.
 */
const buildLabResultData = (
  result: IdexxResult,
  patient: Record<string, unknown>,
  organisationId: string | null,
) => ({
  organisationId,
  orderId: coerceString(result.orderId),
  requisitionId: coerceString(result.requisitionId),
  accessionId: coerceString(result.accessionId),
  diagnosticSetId: coerceString(result.diagnosticSetId),
  status: coerceString(result.status),
  statusDetail: coerceString(result.statusDetail),
  modality: coerceString(result.modality),
  patientId: coerceString(patient.patientId),
  patientName: coerceString(patient.name),
  clientId: coerceString(patient.clientId),
  clientFirstName: coerceString(patient.clientFirstName),
  clientLastName: coerceString(patient.clientLastName),
  updatedDate: coerceString(result.updatedDate),
  updatedAuditDate: coerceString(result.updatedAuditDate),
  specimenCollectionDate: coerceString(result.specimenCollectionDate),
});

const mapResultStatusToLabOrder = (
  result: IdexxResult,
): LabOrderStatus | null => {
  const status = coerceStringOrEmpty(result.status).toUpperCase();
  const detail = coerceStringOrEmpty(result.statusDetail).toUpperCase();
  const modality = coerceStringOrEmpty(result.modality).toUpperCase();

  if (status === "COMPLETE") return "COMPLETE";
  if (status === "CANCELLED") return "CANCELLED";
  if (detail === "ATLAB") return "AT_THE_LAB";
  if (detail === "PARTIAL") return "PARTIAL";
  if (modality === "INHOUSE") return "RUNNING";
  if (status === "INPROCESS") return "RUNNING";
  return null;
};

const buildResultTaskKey = (resultId: string) => `lab-result:${resultId}`;

const ensureResultTask = async (params: {
  organisationId: string;
  patientId: string;
  appointmentId?: string | null;
  createdByUserId?: string | null;
  resultId: string;
}) => {
  const existing = await prisma.task.findFirst({
    where: {
      patientId: params.patientId,
      category: "LAB_RESULTS",
      status: { in: ["PENDING", "IN_PROGRESS"] },
      additionalNotes: buildResultTaskKey(params.resultId),
    },
    select: { id: true },
  });

  if (existing) return;

  const actor = params.createdByUserId ?? "SYSTEM";
  await TaskService.createCustom({
    organisationId: params.organisationId,
    appointmentId: params.appointmentId ?? undefined,
    patientId: params.patientId,
    createdBy: actor,
    assignedBy: actor,
    assignedTo: actor,
    audience: "EMPLOYEE_TASK",
    category: "LAB_RESULTS",
    name: "Review lab results",
    description: `Lab results are ready for review (Result ID: ${params.resultId}).`,
    additionalNotes: buildResultTaskKey(params.resultId),
    dueAt: new Date(),
    timezone: undefined,
  });
};

const ensureResultDocument = async (params: {
  organisationId: string;
  patientId: string;
  appointmentId?: string | null;
  resultId: string;
  issueDate?: string | null;
  createdByUserId?: string | null;
  pdfBuffer: Buffer;
}) => {
  const title = `Lab Result ${params.resultId}`;
  const existing = await prisma.document.findFirst({
    where: {
      patientId: params.patientId,
      category: "HEALTH",
      subcategory: "LAB_TEST",
      title,
    },
    select: { id: true },
  });

  if (existing) return;

  const upload = await uploadBufferAsFile(params.pdfBuffer, {
    folderName: `lab-results/${params.patientId}`,
    mimeType: "application/pdf",
    originalName: `${params.resultId}.pdf`,
  });

  await DocumentService.create(
    {
      patientId: params.patientId,
      appointmentId: params.appointmentId ?? null,
      category: "HEALTH",
      subcategory: "LAB_TEST",
      title,
      issuingBusinessName: "IDEXX",
      issueDate: params.issueDate ?? undefined,
      attachments: [
        {
          key: upload.key,
          mimeType: "application/pdf",
        },
      ],
    },
    {
      organisationId: params.organisationId,
      pmsUserId: params.createdByUserId ?? undefined,
    },
  );
};

type ResultOrderContext = {
  organisationId: string | null;
  appointmentId: string | null;
  createdByUserId: string | null;
  patientId: string | null;
  unmappedStatus: boolean;
};

const syncLabOrderFromResult = async (
  result: IdexxResult,
): Promise<ResultOrderContext> => {
  const context: ResultOrderContext = {
    organisationId: null,
    appointmentId: null,
    createdByUserId: null,
    patientId: null,
    unmappedStatus: false,
  };

  const orderId = coerceString(result.orderId);
  if (!orderId) return context;

  const order = await prisma.labOrder.findFirst({
    where: { idexxOrderId: orderId },
  });

  context.organisationId = order?.organisationId ?? null;
  context.appointmentId = order?.appointmentId ?? null;
  context.createdByUserId = order?.createdByUserId ?? null;
  context.patientId = order?.patientId ?? null;

  if (order) {
    const mappedStatus = mapResultStatusToLabOrder(result);
    if (mappedStatus) {
      await prisma.labOrder.update({
        where: { id: order.id },
        data: {
          status: mappedStatus,
          externalStatus: coerceString(result.status),
          responsePayload: toJsonInput(result),
        },
      });
    } else {
      context.unmappedStatus = true;
      logger.warn("IDEXX result status did not map to a LabOrder status", {
        resultId: coerceString(result.resultId),
        orderId,
        status: coerceString(result.status),
        statusDetail: coerceString(result.statusDetail),
        modality: coerceString(result.modality),
      });
    }
  }

  return context;
};

const upsertLabResult = async (
  result: IdexxResult,
  resultId: string,
  organisationId: string | null,
) => {
  const patient: Record<string, unknown> = result.patient ?? {};
  const basePayload = buildLabResultData(result, patient, organisationId);

  await prisma.labResult.upsert({
    where: {
      provider_resultId: {
        provider: "IDEXX",
        resultId,
      },
    },
    create: {
      provider: "IDEXX",
      resultId,
      ...basePayload,
      rawPayload: toJsonInput(result),
    },
    update: {
      ...basePayload,
      rawPayload: toJsonInput(result),
    },
  });
};

const maybeCreateResultArtifacts = async (
  client: IdexxResultsClient,
  result: IdexxResult,
  resultId: string,
  context: ResultOrderContext,
) => {
  const { organisationId, appointmentId, createdByUserId, patientId } = context;
  if (
    !organisationId ||
    !patientId ||
    coerceStringOrEmpty(result.status).toUpperCase() !== "COMPLETE"
  ) {
    return;
  }

  try {
    const pdf = await client.getResultPdf(resultId);
    await ensureResultDocument({
      organisationId,
      patientId,
      appointmentId,
      resultId,
      issueDate: coerceString(result.updatedDate),
      createdByUserId,
      pdfBuffer: Buffer.from(pdf.data),
    });

    await ensureResultTask({
      organisationId,
      patientId,
      appointmentId,
      createdByUserId,
      resultId,
    });
  } catch (err) {
    logger.error("Failed to create lab result artifacts", err);
  }
};

const processIdexxResult = async (
  client: IdexxResultsClient,
  result: IdexxResult,
) => {
  const context = await syncLabOrderFromResult(result);
  const resultId = coerceStringOrEmpty(result.resultId);
  await upsertLabResult(result, resultId, context.organisationId);
  await maybeCreateResultArtifacts(client, result, resultId, context);
  return context.unmappedStatus;
};

const recordBatchSyncState = async (
  batchId: string,
  timestamp: string | null | undefined,
) => {
  await prisma.labResultSyncState.upsert({
    where: { provider: "IDEXX" },
    create: {
      provider: "IDEXX",
      lastBatchId: String(batchId),
      lastTimestamp: timestamp ?? null,
      lastPolledAt: new Date(),
    },
    update: {
      lastBatchId: String(batchId),
      lastTimestamp: timestamp ?? null,
      lastPolledAt: new Date(),
    },
  });
};

export const IdexxResultsService = {
  async pollLatest(limit = 50, maxBatches = 5) {
    const username = process.env.IDEXX_GLOBAL_USERNAME?.trim();
    const password = process.env.IDEXX_GLOBAL_PASSWORD?.trim();
    const pimsId = process.env.IDEXX_PIMS_ID?.trim();
    const pimsVersion = process.env.IDEXX_PIMS_VERSION?.trim();

    if (!username || !password || !pimsId || !pimsVersion) {
      logger.warn("IDEXX results polling skipped: missing env credentials.");
      return;
    }

    const client = new IdexxResultsClient({
      username,
      password,
      pimsId,
      pimsVersion,
    });

    for (let i = 0; i < maxBatches; i += 1) {
      const latest =
        await client.getLatestResults<LatestResultsResponse>(limit);
      const batchId = latest.batchId;
      const results = Array.isArray(latest.results) ? latest.results : [];

      if (!batchId || results.length === 0) {
        break;
      }

      let hasUnmappedResult = false;
      for (const result of results as IdexxResult[]) {
        const unmapped = await processIdexxResult(client, result);
        hasUnmappedResult ||= unmapped;
      }

      // Confirming tells IDEXX the batch was consumed and stops it being re-sent, so a batch
      // we only half-applied must not be confirmed: the LabOrder status transition for the
      // unmapped row was skipped and would be lost for good. Leave it for the next poll and
      // stop here. Polling stays stuck on this batch until mapResultStatusToLabOrder learns
      // the status, which is the intent - the warning above names the status to add.
      if (hasUnmappedResult) {
        logger.error(
          "IDEXX batch left unconfirmed: a result status did not map to a LabOrder status",
          { batchId },
        );
        break;
      }

      await client.confirmLatestBatch(batchId);
      await recordBatchSyncState(batchId, latest.timestamp);

      if (!latest.hasMoreResults) break;
    }
  },
};
