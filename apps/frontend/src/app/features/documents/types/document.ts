export type OrgDocumentCategory =
  | "TERMS_AND_CONDITIONS"
  | "PRIVACY_POLICY"
  | "CANCELLATION_POLICY"
  | "FIRE_SAFETY"
  | "GENERAL";

export type OrganizationDocument = {
  _id: string;
  organisationId: string;
  title: string;
  description?: string;
  fileUrl: string;
  category: OrgDocumentCategory;
};

export type OrganisationDocumentResponse = {
  data: Document
}

export type Document = {
  organisationId: string;
  title: string;
  description: string;
  category: OrgDocumentCategory;
  fileUrl: string;
  fileSize?: number | null;
  visibility?: string;
  version?: number;
  _id: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}
