import api, { getData } from '@/app/services/axios';

export type DispenseRequestStatus = 'PENDING' | 'NOT_DISPENSED' | 'DISPENSED';

export interface DispenseRequestMedication {
  inventoryItemId: string;
  quantity?: number;
  sourceLineKey?: string;
  medicineName?: string;
  priceCents?: number;
  fulfillment?: 'IN_HOUSE' | 'PATIENT';
  frequency?: string;
  dosage?: string;
  route?: string;
  lowStock?: boolean;
  stockQty?: number;
  inventoryBatchId?: string;
  medication?: string;
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
