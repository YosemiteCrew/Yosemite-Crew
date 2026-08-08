export type OrgDocumentCategory =
  | "TERMS_AND_CONDITIONS"
  | "PRIVACY_POLICY"
  | "CANCELLATION_POLICY"
  | "FIRE_SAFETY"
  | "GENERAL";

export interface OrganizationDocumentMongo {
  organisationId: string;

  title: string;
  description?: string;

  category: OrgDocumentCategory;

  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  pdfUrl?: string;

  visibility: "INTERNAL" | "PUBLIC";

  // Optional version number if they replace file (useful for legal docs)
  version?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationDocumentDocument extends OrganizationDocumentMongo {
  _id: string;
}
