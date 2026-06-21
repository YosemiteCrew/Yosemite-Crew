import { Request, Response } from "express";
import { z } from "zod";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "src/services/clinical-artifact.service";
import { clinicalArtifactFhirMapper } from "src/services/fhir-clinical-artifact.mapper";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "src/services/inventory-consumption.service";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import { resolveUserIdFromRequest } from "src/utils/request";

const actionBodySchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  reason: z.string().trim().min(1).optional(),
});

const dispenseRequestListQuerySchema = z.object({
  status: z.enum(["PENDING", "NOT_DISPENSED", "DISPENSED"]).optional(),
  prescriptionId: z.string().trim().min(1).optional(),
});

const handleError = createFhirErrorHandler({
  isServiceError: (
    error,
  ): error is ClinicalArtifactServiceError | InventoryConsumptionServiceError =>
    error instanceof ClinicalArtifactServiceError ||
    error instanceof InventoryConsumptionServiceError,
  invalidPayloadMessage: "Invalid prescription action payload.",
  logMessage: "Unexpected prescription action error",
});

const loadPrescription = async (
  organisationId: string,
  prescriptionId: string,
) => ClinicalArtifactService.getPrescription(prescriptionId, organisationId);

const buildMetadata = (
  body: z.infer<typeof actionBodySchema>,
  req: Request,
  action: string,
) => ({
  ...(body.metadata ?? {}),
  action,
  performedBy: resolveUserIdFromRequest(req),
  reason: body.reason ?? undefined,
  performedAt: new Date().toISOString(),
});

const respondWithAction = (
  res: Response,
  action: "RESERVE" | "DISPENSE" | "NOT_DISPENSED" | "RETURN" | "VOID_DISPENSE",
  prescriptionId: string,
  inventoryEvents: unknown,
  prescription: unknown,
) =>
  res.status(200).json({
    action,
    prescriptionId,
    prescription,
    inventoryEvents,
  });

export const PrescriptionController = {
  async listDispenseRequests(req: Request, res: Response) {
    try {
      const query = dispenseRequestListQuerySchema.parse(req.query ?? {});
      const records =
        await InventoryConsumptionService.listPrescriptionDispenseRequests({
          organisationId: req.params.organisationId,
          status: query.status,
          prescriptionId: query.prescriptionId,
        });
      return res.status(200).json(records);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getDispenseRequest(req: Request, res: Response) {
    try {
      const record =
        await InventoryConsumptionService.getPrescriptionDispenseRequest({
          organisationId: req.params.organisationId,
          dispenseRequestId: req.params.dispenseRequestId,
        });
      return res.status(200).json(record);
    } catch (error) {
      return handleError(error, res);
    }
  },

  async reserve(req: Request, res: Response) {
    try {
      const body = actionBodySchema.parse(req.body);
      const prescription = await loadPrescription(
        req.params.organisationId,
        req.params.prescriptionId,
      );
      const inventoryEvents =
        await InventoryConsumptionService.reservePrescription({
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          medications: prescription.prescription.medications,
          metadata: buildMetadata(body, req, "RESERVE"),
        });
      return respondWithAction(
        res,
        "RESERVE",
        prescription.prescription.id,
        inventoryEvents,
        clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
          prescription,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async dispense(req: Request, res: Response) {
    try {
      const body = actionBodySchema.parse(req.body);
      const prescription = await loadPrescription(
        req.params.organisationId,
        req.params.prescriptionId,
      );
      const metadata = buildMetadata(body, req, "DISPENSE");
      const inventoryEvents =
        await InventoryConsumptionService.approvePrescriptionDispenseRequest({
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          medications: prescription.prescription.medications,
          metadata,
          reviewedBy: metadata.performedBy,
        });
      return respondWithAction(
        res,
        "DISPENSE",
        prescription.prescription.id,
        inventoryEvents,
        clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
          prescription,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async notDispensed(req: Request, res: Response) {
    try {
      const body = actionBodySchema.parse(req.body);
      const prescription = await loadPrescription(
        req.params.organisationId,
        req.params.prescriptionId,
      );
      const metadata = buildMetadata(body, req, "NOT_DISPENSED");
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          metadata,
          reviewedBy: metadata.performedBy,
        },
      );
      return respondWithAction(
        res,
        "NOT_DISPENSED",
        prescription.prescription.id,
        [],
        clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
          prescription,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async returnPrescription(req: Request, res: Response) {
    try {
      const body = actionBodySchema.parse(req.body);
      const prescription = await loadPrescription(
        req.params.organisationId,
        req.params.prescriptionId,
      );
      const inventoryEvents =
        await InventoryConsumptionService.returnPrescription({
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          medications: prescription.prescription.medications,
          metadata: buildMetadata(body, req, "RETURN"),
        });
      return respondWithAction(
        res,
        "RETURN",
        prescription.prescription.id,
        inventoryEvents,
        clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
          prescription,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async voidDispense(req: Request, res: Response) {
    try {
      const body = actionBodySchema.parse(req.body);
      const prescription = await loadPrescription(
        req.params.organisationId,
        req.params.prescriptionId,
      );
      const inventoryEvents =
        await InventoryConsumptionService.voidDispensePrescription({
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          medications: prescription.prescription.medications,
          metadata: buildMetadata(body, req, "VOID_DISPENSE"),
        });
      return respondWithAction(
        res,
        "VOID_DISPENSE",
        prescription.prescription.id,
        inventoryEvents,
        clinicalArtifactFhirMapper.prescriptionToMedicationRequest(
          prescription,
        ),
      );
    } catch (error) {
      return handleError(error, res);
    }
  },
};
