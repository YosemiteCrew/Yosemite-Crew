export type ClinicalDocumentType =
  | 'DISCHARGE_SUMMARY'
  | 'SOAP_NOTE'
  | 'PRESCRIPTION'
  | 'PRESCRIPTION_LABEL'
  | 'VITAL_RECORD'
  | 'INVOICE';

export type DocumentSignatureStatus = 'SIGNED' | 'PENDING';

export type OrganizationBranding = {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  phone?: string;
  email?: string;
  logoUrl?: string | null;
  legalName?: string;
  footerText?: string;
  timezone?: string;
};

export type DocumentSignature = {
  status: DocumentSignatureStatus;
  signerName?: string;
  signerRole?: string;
  signerDegree?: string;
  signerEmail?: string;
  authMethod?: string;
  signedAt?: Date;
  label?: string;
};

export type BaseClinicalDocumentData = {
  title: string;
  printedBy?: string;
  signature?: DocumentSignature;
};

export type ClinicalDocumentDataByType = {
  DISCHARGE_SUMMARY: DischargeSummaryDocumentData;
  SOAP_NOTE: SoapNoteDocumentData;
  PRESCRIPTION: PrescriptionDocumentData;
  PRESCRIPTION_LABEL: PrescriptionLabelDocumentData;
  VITAL_RECORD: VitalRecordDocumentData;
  INVOICE: InvoiceDocumentData;
};

export type PdfGenerationInput<TData extends BaseClinicalDocumentData = BaseClinicalDocumentData> =
  {
    documentType: ClinicalDocumentType;
    organization: OrganizationBranding;
    data: TData;
  };

export type PdfTheme = {
  colors: {
    brand: string;
    brandDark: string;
    text: string;
    muted: string;
    border: string;
    panel: string;
    success: string;
  };
  fonts: {
    regular: string;
    bold: string;
    italic: string;
  };
  fontSizes: {
    title: number;
    sectionTitle: number;
    subtitle: number;
    body: number;
    small: number;
    tiny: number;
  };
  spacing: {
    pageMarginX: number;
    headerHeight: number;
    footerHeight: number;
    contentTopGap: number;
    contentBottomGap: number;
    sectionGap: number;
    paragraphGap: number;
    itemGap: number;
    tableCellPaddingX: number;
    tableCellPaddingY: number;
  };
};

export type DischargeSummaryDocumentData = BaseClinicalDocumentData & {
  date: Date;
  appointmentId: string;
  doctorName: string;
  patientName: string;
  speciesBreed: string;
  ageSex: string;
  clientName: string;
  clientId: string;
  contact: string;
  chiefComplaint: string;
  treatmentSummary: string;
  procedures: string[];
  diagnostics: string[];
  dischargeSummary: string;
  homeCare: string[];
  emergencyCare: string[];
  emergencyContact: string;
};

export type SoapNoteDocumentData = BaseClinicalDocumentData & {
  date: Date;
  appointmentId?: string;
  doctorName: string;
  patientName: string;
  speciesBreed?: string;
  ageSex?: string;
  clientName?: string;
  clientId?: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type PrescriptionItem = {
  medication: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  controlled?: boolean;
};

export type PrescriptionDocumentData = BaseClinicalDocumentData & {
  date: Date;
  appointmentId?: string;
  prescriptionId?: string;
  leadName: string;
  patientName: string;
  clientName: string;
  clientId: string;
  clientContact: string;
  speciesBreed?: string;
  ageSex?: string;
  items: PrescriptionItem[];
  notes?: string;
};

export type PrescriptionLabelDocumentData = BaseClinicalDocumentData & {
  date: Date;
  prescriptionId?: string;
  patientName: string;
  clientName: string;
  prescriberName: string;
  organisationName: string;
  items: PrescriptionItem[];
};

export type VitalRecordMeasurement = {
  label: string;
  value: string;
  unit?: string;
  referenceRange?: string;
};

export type VitalRecordDocumentData = BaseClinicalDocumentData & {
  date: Date;
  appointmentId?: string;
  recordedBy?: string;
  recordedAt?: string;
  patientName: string;
  speciesBreed?: string;
  ageSex?: string;
  clientName?: string;
  clientId?: string;
  contact?: string;
  measurements: VitalRecordMeasurement[];
  notes?: string;
  metadata?: unknown;
};

export type InvoiceItem = {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceDocumentData = BaseClinicalDocumentData & {
  invoiceNumber: string;
  currency: string;
  date: Date;
  dueDate?: Date;
  clientName: string;
  clientId?: string;
  patientName?: string;
  doctorName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentNotes?: string;
};

export type KeyValueItem = {
  label: string;
  value: string;
};

export type PdfRichTextRun = {
  text: string;
  bold?: boolean;
};

export type PdfParagraphSectionContent = {
  type: 'paragraph';
  text: string;
};

export type PdfBulletsSectionContent = {
  type: 'bullets';
  items: string[];
};

export type PdfRichTextSectionContent = {
  type: 'richText';
  runs: PdfRichTextRun[] | string;
};

export type PdfTableSectionContent = {
  type: 'table';
  columns: TableColumn[];
  rows: string[][];
};

export type PdfSectionContent =
  | PdfParagraphSectionContent
  | PdfBulletsSectionContent
  | PdfRichTextSectionContent
  | PdfTableSectionContent;

export type PdfSectionDefinition = {
  title: string;
  content: PdfSectionContent[];
};

export type GenericInvoiceRenderData = {
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  grandTotal: number;
  amountPaid?: number;
  balanceDue?: number;
};

export type GeneratePdfInput = {
  documentType:
    | 'discharge-summary'
    | 'soap-note'
    | 'prescription'
    | 'vital-record'
    | 'invoice'
    | string;
  title: string;
  organization: OrganizationBranding;
  metadataGroups?: KeyValueItem[][];
  sections: PdfSectionDefinition[];
  signature?: DocumentSignature;
  invoice?: GenericInvoiceRenderData;
  generatedAt?: Date;
  printedBy?: string;
};

export type TableColumn = {
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

export type TableRenderInput = {
  columns: TableColumn[];
  rows: string[][];
  rowHeight?: number;
  headerHeight?: number;
};

export type DocumentEndBlockInput = {
  printedBy?: string;
  signature?: DocumentSignature;
};

export type RenderHeaderInput = {
  organization: OrganizationBranding;
};

export type RenderFooterInput = {
  organization: OrganizationBranding;
  generatedAt?: Date;
};

export type ClinicalPdfSignaturePlacement = {
  pageNumber: number;
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

export type ClinicalPdfRenderResult = {
  pdf: Buffer;
  pageCount: number;
  signaturePlacement: ClinicalPdfSignaturePlacement;
};
