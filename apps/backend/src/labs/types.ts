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
  patientId: string;
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
  Omit<LabOrderCreateInput, "organisationId" | "patientId">
> & {
  tests?: string[];
};

/**
 * Set when the breed sent to the provider is not the companion's recorded breed,
 * because the provider's own vocabulary has no counterpart for it. Callers should
 * surface this rather than let a substituted breed look like the real one.
 */
export type LabBreedSubstitution = {
  requestedBreedCode: string | null;
  usedBreedCode: string;
  usedTargetCode: string;
  reason: "UNCODED_BREED" | "UNMAPPED_BREED";
};

export type LabOrderCreateResult = {
  breedSubstitution?: LabBreedSubstitution | null;
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
  getOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult>;
  updateOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult>;
  cancelOrder(
    idexxOrderId: string,
    input: LabOrderCreateInput,
  ): Promise<LabOrderCreateResult>;
}
