import { Schema, model, type HydratedDocument } from "mongoose";


export type LabResultStatus = "INPROCESS" | "COMPLETE" | "CANCELLED";
export type LabResultStatusDetail = "ATLAB" | "PARTIAL" | null;
export type LabResultModality = "REFLAB" | "INHOUSE" | "DIGITAL" | "OTHER" | null;

export interface LabResultMongo {
  organisationId?: string | null;
  provider: string;
  resultId: string;
  orderId?: string | null;
  requisitionId?: string | null;
  accessionId?: string | null;
  diagnosticSetId?: string | null;
  status?: LabResultStatus | null;
  statusDetail?: LabResultStatusDetail;
  modality?: LabResultModality;
  patientId?: string | null;
  patientName?: string | null;
  clientId?: string | null;
  clientFirstName?: string | null;
  clientLastName?: string | null;
  updatedDate?: string | null;
  updatedAuditDate?: string | null;
  specimenCollectionDate?: string | null;
  rawPayload?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const LabResultSchema = new Schema<LabResultMongo>(
  {
    organisationId: { type: String, default: null, index: true },
    provider: { type: String, required: true, index: true },
    resultId: { type: String, required: true, index: true },
    orderId: { type: String, default: null, index: true },
    requisitionId: { type: String, default: null },
    accessionId: { type: String, default: null },
    diagnosticSetId: { type: String, default: null },
    status: { type: String, default: null },
    statusDetail: { type: String, default: null },
    modality: { type: String, default: null },
    patientId: { type: String, default: null },
    patientName: { type: String, default: null },
    clientId: { type: String, default: null },
    clientFirstName: { type: String, default: null },
    clientLastName: { type: String, default: null },
    updatedDate: { type: String, default: null },
    updatedAuditDate: { type: String, default: null },
    specimenCollectionDate: { type: String, default: null },
    rawPayload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "lab_results" },
);

LabResultSchema.index({ provider: 1, resultId: 1 }, { unique: true });
LabResultSchema.index({ provider: 1, orderId: 1 });

export type LabResultDocument = HydratedDocument<LabResultMongo>;

export default model<LabResultMongo>("LabResult", LabResultSchema);
