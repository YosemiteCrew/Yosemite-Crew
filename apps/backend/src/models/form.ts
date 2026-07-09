export interface SigningInfo {
  required: boolean;

  status: "NOT_STARTED" | "IN_PROGRESS" | "SIGNED";

  provider: "DOCUMENSO";

  documentId?: string;

  signedAt?: Date;

  signer?: {
    userId?: string;
    email?: string;
    role: "CLIENT" | "VET";
  };

  pdf?: {
    url?: string;
    sha256?: string;
  };
}

export interface FormSubmissionDocument {
  formId: string;
  formVersion: number;
  appointmentId?: string;
  patientId?: string;
  parentId?: string;
  submittedBy?: string;
  answers: Record<string, unknown>;
  submittedAt: Date;
  signing?: SigningInfo;
}
