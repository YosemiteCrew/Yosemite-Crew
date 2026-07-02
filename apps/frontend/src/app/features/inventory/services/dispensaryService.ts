import api, { getData } from '@/app/services/axios';

export type DispenseRequestStatus = 'PENDING' | 'NOT_DISPENSED' | 'DISPENSED';

export interface DispenseRequestMedication {
  inventoryItemId: string;
  quantity?: number;
  sourceLineKey?: string;
  /** Display name — prefer inventoryItemName, fall back to medication */
  medicineName?: string;
  inventoryItemName?: string;
  medication?: string;
  priceCents?: number;
  fulfillment?: 'IN_HOUSE' | 'PATIENT';
  // enriched prescription fields
  frequency?: string;
  frequencyPerDay?: number;
  durationDays?: number;
  doseQty?: number;
  doseUnit?: string;
  refillsRemaining?: number;
  isRx?: boolean;
  isControlled?: boolean;
  // stock unit fields
  stockUnitQty?: number | null;
  stockUnitQuantity?: number | null;
  packageQuantity?: number | null;
  unitQuantity?: number | null;
  stockUnitType?: string | null;
  // legacy / misc
  dosage?: string | null;
  route?: string | null;
  duration?: string | null;
  strength?: string | null;
  instructions?: string | null;
  metadata?: Record<string, unknown> | null;
  lowStock?: boolean;
  stockQty?: number;
  batchId?: string;
  inventoryBatchId?: string;
}

export interface DispenseRequestPrescription {
  id: string;
  artifactId: string;
  artifact: {
    id: string;
    kind: string;
    status: string;
    appointmentId: string | null;
    summary: string | null;
  };
}

export interface DispenseRequestApi {
  id: string;
  prescriptionId: string;
  organisationId: string;
  status: DispenseRequestStatus;
  medications: DispenseRequestMedication[];
  metadata: Record<string, unknown> | null;
  patientName: string | null;
  parentName: string | null;
  petBreed: string | null;
  petAge: string | null;
  patientImageUrl: string | null;
  leadName: string | null;
  location: string | null;
  invoiceId: string | null;
  paymentStatus: 'PAID' | 'UNPAID' | null;
  currency: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  prescription: DispenseRequestPrescription;
}

export const listDispenseRequests = async (
  organisationId: string,
  status?: DispenseRequestStatus
): Promise<DispenseRequestApi[]> => {
  const params = status ? `?status=${status}` : '';
  const res = await getData<DispenseRequestApi[]>(
    `/v1/prescriptions/organisations/${organisationId}/prescription-dispense-requests${params}`
  );
  return res.data;
};

export const getDispenseRequest = async (
  organisationId: string,
  dispenseRequestId: string
): Promise<DispenseRequestApi> => {
  const res = await getData<DispenseRequestApi>(
    `/v1/prescriptions/organisations/${organisationId}/prescription-dispense-requests/${dispenseRequestId}`
  );
  return res.data;
};

export const fetchPrescriptionLabelPdf = async (
  organisationId: string,
  prescriptionId: string
): Promise<Blob> => {
  const res = await api.get<Blob>(
    `/v1/prescriptions/organisations/${organisationId}/${prescriptionId}/label.pdf`,
    { responseType: 'blob' }
  );
  return res.data;
};
