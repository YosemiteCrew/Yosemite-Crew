export interface Document {
  id: string;
  companionId: string;
  category: string;
  subcategory: string;
  visitType: string;
  title: string;
  businessName: string;
  issueDate: string;
  files: DocumentFile[];
  createdAt: string;
  updatedAt: string;
  isSynced: boolean;
  isUserAdded: boolean; // true if added by user from app, false if synced from PMS
}

export interface DocumentFile {
  id: string;
  uri: string;
  name: string;
  type: string;
  size: number;
  s3Url?: string;
}

export interface DocumentCategory {
  id: string;
  label: string;
  icon: any;
  isSynced: boolean;
  fileCount: number;
  subcategories: DocumentSubcategory[];
}

export interface DocumentSubcategory {
  id: string;
  label: string;
  fileCount: number;
}

export interface DocumentFormData {
  companionId: string;
  category: string | null;
  subcategory: string | null;
  visitType: string | null;
  title: string;
  businessName: string;
  hasIssueDate: boolean;
  issueDate: string;
  files: DocumentFile[];
}

export interface S3UploadParams {
  fileName: string;
  fileType: string;
  fileUri: string;
}

export interface S3SignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
}
