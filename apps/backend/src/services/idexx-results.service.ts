import LabResultModel, {
  type LabResultDocument,
  type LabResultMongo,
} from "src/models/lab-result";
import LabResultSyncStateModel, {
  type LabResultSyncStateDocument,
  type LabResultSyncStateMongo,
} from "src/models/lab-result-sync-state";
import LabOrderModel from "src/models/lab-order";
import DocumentModel from "src/models/document";
import TaskModel from "src/models/task";
import { IdexxResultsClient } from "src/integrations/idexx/idexx-results.client";
import { prisma } from "src/config/prisma";
import { Prisma, LabOrderStatus } from "@prisma/client";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
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

const toJsonInput = (
  value: Record<string, unknown> | null | undefined,
) => {
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

const syncLabResultToPostgres = async (doc: LabResultDocument) => {
  if (!shouldDualWrite) return;
  try {
    const obj = doc.toObject<LabResultMongo>();
    await prisma.labResult.upsert({
      where: {
        provider_resultId: {
          provider: obj.provider,
          resultId: obj.resultId,
        },
      },
      create: {
        provider: obj.provider,
        resultId: obj.resultId,
        organisationId: obj.organisationId ?? null,
        orderId: obj.orderId ?? null,
        requisitionId: obj.requisitionId ?? null,
        accessionId: obj.accessionId ?? null,
        diagnosticSetId: obj.diagnosticSetId ?? null,
        status: obj.status ?? null,
        statusDetail: obj.statusDetail ?? null,
        modality: obj.modality ?? null,
        patientId: obj.patientId ?? null,
        patientName: obj.patientName ?? null,
        clientId: obj.clientId ?? null,
        clientFirstName: obj.clientFirstName ?? null,
        clientLastName: obj.clientLastName ?? null,
        updatedDate: obj.updatedDate ?? null,
        updatedAuditDate: obj.updatedAuditDate ?? null,
        specimenCollectionDate: obj.specimenCollectionDate ?? null,
        rawPayload: toJsonInput(obj.rawPayload),
      },
      update: {
        organisationId: obj.organisationId ?? null,
        orderId: obj.orderId ?? null,
        requisitionId: obj.requisitionId ?? null,
        accessionId: obj.accessionId ?? null,
        diagnosticSetId: obj.diagnosticSetId ?? null,
        status: obj.status ?? null,
        statusDetail: obj.statusDetail ?? null,
        modality: obj.modality ?? null,
        patientId: obj.patientId ?? null,
        patientName: obj.patientName ?? null,
        clientId: obj.clientId ?? null,
        clientFirstName: obj.clientFirstName ?? null,
        clientLastName: obj.clientLastName ?? null,
        updatedDate: obj.updatedDate ?? null,
        updatedAuditDate: obj.updatedAuditDate ?? null,
        specimenCollectionDate: obj.specimenCollectionDate ?? null,
        rawPayload: toJsonInput(obj.rawPayload),
      },
    });
  } catch (err) {
    handleDualWriteError("LabResult", err);
  }
};

const syncStateToPostgres = async (doc: LabResultSyncStateDocument) => {
  if (!shouldDualWrite) return;
  try {
    const obj = doc.toObject<LabResultSyncStateMongo>();
    await prisma.labResultSyncState.upsert({
      where: { provider: obj.provider },
      create: {
        provider: obj.provider,
        lastBatchId: obj.lastBatchId ?? null,
        lastTimestamp: obj.lastTimestamp ?? null,
        lastPolledAt: obj.lastPolledAt ?? null,
      },
      update: {
        lastBatchId: obj.lastBatchId ?? null,
        lastTimestamp: obj.lastTimestamp ?? null,
        lastPolledAt: obj.lastPolledAt ?? null,
      },
    });
  } catch (err) {
    handleDualWriteError("LabResultSyncState", err);
  }
};

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

const syncLabOrderStatusToPostgres = async (params: {
  id: string;
  status: LabOrderStatus;
  externalStatus: string | null;
  responsePayload: Record<string, unknown>;
}) => {
  if (!shouldDualWrite) return;
  try {
    await prisma.labOrder.update({
      where: { id: params.id },
      data: {
        status: params.status,
        externalStatus: params.externalStatus,
        responsePayload: toJsonInput(params.responsePayload),
      },
    });
  } catch (err) {
    handleDualWriteError("LabOrder", err);
  }
};

const getEnv = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim() ? value : null;
};

const buildResultTaskKey = (resultId: string) => `lab-result:${resultId}`;

const ensureResultTask = async (params: {
  organisationId: string;
  companionId: string;
  appointmentId?: string | null;
  createdByUserId?: string | null;
  resultId: string;
}) => {
  const existing = await TaskModel.findOne({
    companionId: params.companionId,
    category: "LAB_RESULTS",
    status: { $in: ["PENDING", "IN_PROGRESS"] },
    additionalNotes: buildResultTaskKey(params.resultId),
  }).lean();

  if (existing) return;

  const actor = params.createdByUserId ?? "SYSTEM";
  await TaskService.createCustom({
    organisationId: params.organisationId,
    appointmentId: params.appointmentId ?? undefined,
    companionId: params.companionId,
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
  companionId: string;
  appointmentId?: string | null;
  resultId: string;
  issueDate?: string | null;
  createdByUserId?: string | null;
  pdfBuffer: Buffer;
}) => {
  const title = `Lab Result ${params.resultId}`;
  const existing = await DocumentModel.findOne({
    companionId: params.companionId,
    category: "HEALTH",
    subcategory: "LAB_TESTS",
    title,
  }).lean();

  if (existing) return;

  const upload = await uploadBufferAsFile(params.pdfBuffer, {
    folderName: `lab-results/${params.companionId}`,
    mimeType: "application/pdf",
    originalName: `${params.resultId}.pdf`,
  });

  await DocumentService.create(
    {
      companionId: params.companionId,
      appointmentId: params.appointmentId ?? null,
      category: "HEALTH",
      subcategory: "LAB_TESTS",
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

export const IdexxResultsService = {
  async pollLatest(limit = 50, maxBatches = 5) {
    const username = getEnv("IDEXX_GLOBAL_USERNAME");
    const password = getEnv("IDEXX_GLOBAL_PASSWORD");
    const pimsId = getEnv("IDEXX_PIMS_ID");
    const pimsVersion = getEnv("IDEXX_PIMS_VERSION");

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
      const latest = await client.getLatestResults<LatestResultsResponse>(limit);
      const batchId = latest.batchId;
      const results = Array.isArray(latest.results) ? latest.results : [];

      if (!batchId || results.length === 0) {
        break;
      }

      for (const result of results as IdexxResult[]) {
        const orderId = coerceString(result.orderId);
        let organisationId: string | null = null;
        let appointmentId: string | null = null;
        let createdByUserId: string | null = null;
        let companionId: string | null = null;

        if (orderId) {
          const order = await LabOrderModel.findOne({
            idexxOrderId: orderId,
          }).lean();
          organisationId = order?.organisationId ?? null;
          appointmentId = order?.appointmentId
            ? order.appointmentId.toString()
            : null;
          createdByUserId = order?.createdByUserId ?? null;
          companionId = order?.companionId ? order.companionId.toString() : null;

          if (order) {
            const mappedStatus = mapResultStatusToLabOrder(result);
            if (mappedStatus) {
              await LabOrderModel.updateOne(
                { _id: order._id },
                {
                  $set: {
                    status: mappedStatus,
                    externalStatus: coerceString(result.status),
                    responsePayload: result,
                  },
                },
              );

              await syncLabOrderStatusToPostgres({
                id: order._id.toString(),
                status: mappedStatus,
                externalStatus: coerceString(result.status),
                responsePayload: result,
              });
            }
          }
        }

        const patient: Record<string, unknown> = result.patient ?? {};
        const resultId = coerceStringOrEmpty(result.resultId);

        const saved = await LabResultModel.findOneAndUpdate(
          { provider: "IDEXX", resultId },
          {
            $set: {
              organisationId,
              provider: "IDEXX",
              resultId,
              orderId,
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
              rawPayload: result,
            },
          },
          { upsert: true, new: true },
        );

        if (saved) {
          await syncLabResultToPostgres(saved);
        }

        if (
          organisationId &&
          companionId &&
          coerceStringOrEmpty(result.status).toUpperCase() === "COMPLETE"
        ) {
          try {
            const pdf = await client.getResultPdf(resultId);
            await ensureResultDocument({
              organisationId,
              companionId,
              appointmentId,
              resultId,
              issueDate: coerceString(result.updatedDate),
              createdByUserId,
              pdfBuffer: Buffer.from(pdf.data),
            });

            await ensureResultTask({
              organisationId,
              companionId,
              appointmentId,
              createdByUserId,
              resultId,
            });
          } catch (err) {
            logger.error("Failed to create lab result artifacts", err);
          }
        }
      }

      await client.confirmLatestBatch(batchId);

      const state = await LabResultSyncStateModel.findOneAndUpdate(
        { provider: "IDEXX" },
        {
          $set: {
            lastBatchId: String(batchId),
            lastTimestamp: latest.timestamp ?? null,
            lastPolledAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      if (state) {
        await syncStateToPostgres(state);
      }

      if (!latest.hasMoreResults) break;
    }
  },
};
