export type {
  BaseClinicalDocumentData,
  ClinicalDocumentDataByType,
  ClinicalDocumentType,
  VitalRecordDocumentData,
  DocumentEndBlockInput,
  DocumentSignature,
  DocumentSignatureStatus,
  DischargeSummaryDocumentData,
  InvoiceDocumentData,
  InvoiceItem,
  ClinicalPdfRenderResult,
  ClinicalPdfSignaturePlacement,
  GeneratePdfInput,
  GenericInvoiceRenderData,
  KeyValueItem,
  OrganizationBranding,
  PdfGenerationInput,
  PdfTheme,
  PdfSectionDefinition,
  PdfSectionContent,
  PdfRichTextRun,
  PrescriptionDocumentData,
  PrescriptionLabelDocumentData,
  PrescriptionItem,
  VitalRecordMeasurement,
  RenderFooterInput,
  RenderHeaderInput,
  SoapNoteDocumentData,
  TableColumn,
  TableRenderInput,
} from './types.js';
export { BasePdfTemplate } from './BasePdfTemplate.js';
export {
  generateClinicalPdf,
  generateClinicalPdfWithMetadata,
  generateCombinedClinicalPdf,
  generateCombinedClinicalPdfWithMetadata,
  createClinicalPdfContext,
  clinicalPdfTheme,
  type CombinedClinicalSection,
  type CombinedClinicalDocumentInput,
} from './PdfEngine.js';
export { generatePdf, generatePdfWithMetadata } from './GenericPdfEngine.js';
export {
  generateResolvedTemplatePdf,
  generateResolvedTemplatePdfWithMetadata,
  type ResolvedTemplatePdfInput,
} from './ResolvedTemplatePdfEngine.js';
export {
  buildMergedClinicalPacketPdf,
  ClinicalPacketPdfError,
  type BuildMergedClinicalPacketPdfInput,
  type MergedClinicalPacketPdf,
  type MergedPacketDocument,
  type PacketDocumentPdfLoader,
} from './clinicalPacket.js';
export { mergePdfBuffers } from './mergePdf.js';
/**
 * Outbound-request building blocks shared with any service that fetches a
 * document over the network: classify an address, resolve a hostname to the
 * public addresses it maps to, and pin a connection to addresses already
 * checked. Exported so callers reuse this one implementation rather than
 * writing their own host checks.
 */
export {
  buildPinnedAgent,
  isPrivateAddress,
  resolveLogoSource,
  resolvePublicAddresses,
} from './resolveLogoSource.js';
export * from './examples/index.js';
