export const LAB_PROVIDERS = ["IDEXX"] as const;
export type LabProvider = (typeof LAB_PROVIDERS)[number];

export const normalizeLabProvider = (
  value: string | undefined | null,
): LabProvider | null => {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "IDEXX") return "IDEXX";
  return null;
};

export type LabOrderCreateInput = {
  organisationId: string;
  companionId: string;
  parentId?: string;
  appointmentId?: string;
  createdByUserId?: string;
  tests: string[];
  modality?: "IN_HOUSE" | "REFERENCE_LAB";
  ivls?: Array<{ serialNumber: string }>;
  veterinarian?: string | null;
  technician?: string | null;
  notes?: string | null;
  specimenCollectionDate?: string | null;
};

export type LabOrderUpdateInput = Partial<
  Omit<LabOrderCreateInput, "organisationId" | "companionId">
> & {
  tests?: string[];
};

export type LabOrderCreateResult = {
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  idexxOrderId?: string | null;
  uiUrl?: string | null;
  pdfUrl?: string | null;
  status?:
    | "CREATED"
    | "SUBMITTED"
    | "AT_THE_LAB"
    | "PARTIAL"
    | "RUNNING"
    | "COMPLETE"
    | "CANCELLED"
    | "ERROR";
  externalStatus?: string | null;
};

export interface LabOrderAdapter {
  createOrder(input: LabOrderCreateInput): Promise<LabOrderCreateResult>;
  getOrder(idexxOrderId: string, input: LabOrderCreateInput): Promise<LabOrderCreateResult>;
  updateOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult>;
  cancelOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult>;
}
