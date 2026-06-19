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
  action: "RESERVE" | "DISPENSE" | "RETURN" | "VOID_DISPENSE",
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
      const inventoryEvents =
        await InventoryConsumptionService.consumePrescription({
          organisationId: req.params.organisationId,
          prescriptionId: prescription.prescription.id,
          medications: prescription.prescription.medications,
          metadata: buildMetadata(body, req, "DISPENSE"),
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
