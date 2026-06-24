import fs from 'node:fs';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { registerPdfFonts, type PdfFontFamilies } from './fonts.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_LAYOUT, PDF_PAGE_SIZE, PDF_SPACING } from './layout.js';
import { renderFooter } from './branding/Footer.js';
import { renderHeader } from './branding/Header.js';
import { PdfContext } from './PdfContext.js';
import type { PdfDocumentInstance } from './PdfContext.js';
import type {
  BaseClinicalDocumentData,
  ClinicalDocumentType,
  ClinicalPdfRenderResult,
  DischargeSummaryDocumentData,
  DocumentSignature,
  OrganizationBranding,
  PdfGenerationInput,
  PrescriptionDocumentData,
  PdfTheme,
  SoapNoteDocumentData,
  VitalRecordDocumentData,
} from './types.js';
import {
  renderDischargeSummaryContent,
  renderDischargeSummaryTemplate,
} from './templates/DischargeSummaryTemplate.js';
import { renderInvoiceTemplate } from './templates/InvoiceTemplate.js';
import { renderPrescriptionLabelTemplate } from './templates/PrescriptionLabelTemplate.js';
import {
  renderPrescriptionContent,
  renderPrescriptionTemplate,
} from './templates/PrescriptionTemplate.js';
import { renderSoapNoteContent, renderSoapNoteTemplate } from './templates/SoapNoteTemplate.js';
import {
  renderVitalRecordContent,
  renderVitalRecordTemplate,
} from './templates/VitalRecordTemplate.js';
import { buildClinicalHeaderKeyValue } from './templates/shared.js';
import { renderDocumentEndBlock } from './sections/DocumentEndBlock.js';
import { renderKeyValueGrid } from './sections/KeyValueGrid.js';
import {
  renderDivider,
  renderDocumentTitle,
  renderParagraph,
  renderSpacer,
} from './sections/Text.js';
import { addPageBreak } from './Pagination.js';

const buildTheme = (fonts: PdfFontFamilies): PdfTheme => ({
  colors: {
    brand: PDF_COLORS.brand,
    brandDark: PDF_COLORS.brandDark,
    text: PDF_COLORS.text,
    muted: PDF_COLORS.muted,
    border: PDF_COLORS.border,
    panel: PDF_COLORS.panel,
    success: PDF_COLORS.success,
  },
  fonts,
  fontSizes: {
    title: PDF_FONT_SIZES.title,
    sectionTitle: PDF_FONT_SIZES.sectionTitle,
    subtitle: PDF_FONT_SIZES.small,
    body: PDF_FONT_SIZES.body,
    small: PDF_FONT_SIZES.small,
    tiny: 7.5,
  },
  spacing: {
    pageMarginX: PDF_LAYOUT.marginX,
    headerHeight: PDF_LAYOUT.headerSeparatorY,
    footerHeight: PDF_PAGE_SIZE.height - PDF_LAYOUT.footerSeparatorY,
    contentTopGap: PDF_SPACING.contentTopGap,
    contentBottomGap: PDF_SPACING.contentBottomGap,
    sectionGap: PDF_SPACING.sectionGap,
    paragraphGap: PDF_SPACING.paragraphGap,
    itemGap: PDF_SPACING.itemGap,
    tableCellPaddingX: PDF_SPACING.tableCellPaddingX,
    tableCellPaddingY: PDF_SPACING.tableCellPaddingY,
  },
});

const createDocument = (): PdfDocumentInstance =>
  new PDFDocument({
    size: [PDF_PAGE_SIZE.width, PDF_PAGE_SIZE.height],
    margin: 0,
    autoFirstPage: true,
    bufferPages: true,
  }) as PdfDocumentInstance;

const collectPdfBuffer = (
  document: PdfDocumentInstance
): {
  promise: Promise<Buffer>;
  reject: (error: Error) => void;
} => {
  const chunks: Buffer[] = [];
  let rejectFn: ((error: Error) => void) | undefined;

  const promise = new Promise<Buffer>((resolve, reject) => {
    rejectFn = reject;

    document.on('data', (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    document.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    document.on('error', reject);
  });

  return {
    promise,
    reject: (error: Error) => {
      rejectFn?.(error);
    },
  };
};

const resolveLogoSource = async (logoUrl?: string | null): Promise<string | Buffer | null> => {
  if (!logoUrl) {
    return null;
  }

  if (/^https?:\/\//i.test(logoUrl)) {
    const response = await axios.get<ArrayBuffer>(logoUrl, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  if (fs.existsSync(logoUrl)) {
    return logoUrl;
  }

  return null;
};

const resolveThemeAndFonts = (document: PdfDocumentInstance) => {
  const fonts = registerPdfFonts(document);
  return {
    fonts,
    theme: buildTheme(fonts),
  };
};

const renderDocumentByType = <TData extends BaseClinicalDocumentData>(
  ctx: PdfContext,
  documentType: ClinicalDocumentType,
  data: TData
): ClinicalPdfRenderResult['signaturePlacement'] => {
  switch (documentType) {
    case 'DISCHARGE_SUMMARY':
      return renderDischargeSummaryTemplate(ctx, data as never);
    case 'SOAP_NOTE':
      return renderSoapNoteTemplate(ctx, data as never);
    case 'PRESCRIPTION':
      return renderPrescriptionTemplate(ctx, data as never);
    case 'PRESCRIPTION_LABEL':
      return renderPrescriptionLabelTemplate(ctx, data as never);
    case 'VITAL_RECORD':
      return renderVitalRecordTemplate(ctx, data as never);
    case 'INVOICE':
      return renderInvoiceTemplate(ctx, data as never);
    default: {
      const exhaustiveCheck: never = documentType;
      throw new Error(`Unsupported clinical document type: ${exhaustiveCheck}`);
    }
  }
};

export const generateClinicalPdfWithMetadata = async <TData extends BaseClinicalDocumentData>(
  input: PdfGenerationInput<TData>
): Promise<ClinicalPdfRenderResult> => {
  const document = createDocument();
  const { fonts, theme } = resolveThemeAndFonts(document);
  const logoSource = await resolveLogoSource(input.organization.logoUrl ?? null);
  const ctx = new PdfContext({
    document,
    organization: input.organization,
    theme,
    fonts,
    logoSource,
  });

  const output = collectPdfBuffer(document);

  try {
    renderHeader(ctx);
    const signaturePlacement = renderDocumentByType(ctx, input.documentType, input.data);

    const pageRange = document.bufferedPageRange();
    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      document.switchToPage(index);
      renderFooter(ctx, index + 1, pageRange.count, ctx.generatedAt);
    }
    document.end();

    const pdf = await output.promise;

    return {
      pdf,
      pageCount: pageRange.count,
      signaturePlacement,
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    output.reject(normalizedError);
    throw normalizedError;
  }
};

export const generateClinicalPdf = async <TData extends BaseClinicalDocumentData>(
  input: PdfGenerationInput<TData>
): Promise<Buffer> => (await generateClinicalPdfWithMetadata(input)).pdf;

// One section of a combined clinical document. Each carries the typed data its
// matching template body renders. INVOICE is intentionally excluded — invoices
// are issued as their own standalone PDF.
export type CombinedClinicalSection =
  | { documentType: 'SOAP_NOTE'; data: SoapNoteDocumentData }
  | { documentType: 'VITAL_RECORD'; data: VitalRecordDocumentData }
  | { documentType: 'PRESCRIPTION'; data: PrescriptionDocumentData }
  | { documentType: 'DISCHARGE_SUMMARY'; data: DischargeSummaryDocumentData };

export type CombinedClinicalDocumentInput = {
  organization: OrganizationBranding;
  // Shared patient/encounter metadata, rendered once at the top of the record.
  header: {
    date: Date;
    appointmentId?: string;
    doctorName?: string;
    patientName?: string;
    clientName?: string;
    clientId?: string;
    clientContact?: string;
    speciesBreed?: string;
    ageSex?: string;
    roomName?: string;
    unitName?: string;
    admittedAt?: string;
    admittedBy?: string;
  };
  sections: CombinedClinicalSection[];
  printedBy?: string;
  signature?: DocumentSignature;
};

const COMBINED_SECTION_LABELS: Record<CombinedClinicalSection['documentType'], string> = {
  SOAP_NOTE: 'SOAP Note',
  VITAL_RECORD: 'Vital Record',
  PRESCRIPTION: 'Prescription',
  DISCHARGE_SUMMARY: 'Discharge Summary',
};

// Each section: a heading (the document title) then its content only — the
// shared patient header is rendered once for the whole record.
const renderCombinedSection = (ctx: PdfContext, section: CombinedClinicalSection): void => {
  renderDocumentTitle(ctx, section.data.title);
  renderSpacer(ctx, ctx.theme.spacing.itemGap);
  switch (section.documentType) {
    case 'SOAP_NOTE':
      renderSoapNoteContent(ctx, section.data);
      return;
    case 'VITAL_RECORD':
      renderVitalRecordContent(ctx, section.data);
      return;
    case 'PRESCRIPTION':
      renderPrescriptionContent(ctx, section.data);
      return;
    case 'DISCHARGE_SUMMARY':
      renderDischargeSummaryContent(ctx, section.data);
      return;
    default: {
      const exhaustiveCheck: never = section;
      throw new Error(`Unsupported combined clinical section: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
};

const renderAttestationPage = (ctx: PdfContext, sections: CombinedClinicalSection[]): void => {
  renderDocumentTitle(ctx, 'Clinical Document Packet');
  renderParagraph(
    ctx,
    'This record combines the documents listed below, signed together as a single, complete clinical record:'
  );
  renderSpacer(ctx, ctx.theme.spacing.itemGap);
  sections.forEach((section, index) => {
    const label = COMBINED_SECTION_LABELS[section.documentType];
    const title = section.data.title?.trim() || label;
    const line =
      title.toLowerCase() === label.toLowerCase()
        ? `${index + 1}. ${title}`
        : `${index + 1}. ${title}  (${label})`;
    renderParagraph(ctx, line);
  });
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  renderParagraph(
    ctx,
    'By signing below I confirm that I have reviewed the documents listed above and that they form a single, complete clinical record.'
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
};

// Renders SOAP, Vital, Prescription and Discharge sections into ONE continuous
// PDF with a single signature on a final attestation page. Used for combined
// clinical packets so the signer signs the whole record once (invoices stay
// separate). Standalone single-document rendering is unchanged.
export const generateCombinedClinicalPdfWithMetadata = async (
  input: CombinedClinicalDocumentInput
): Promise<ClinicalPdfRenderResult> => {
  if (input.sections.length === 0) {
    throw new Error('Cannot render a combined clinical document with no sections');
  }

  const document = createDocument();
  const { fonts, theme } = resolveThemeAndFonts(document);
  const logoSource = await resolveLogoSource(input.organization.logoUrl ?? null);
  const ctx = new PdfContext({
    document,
    organization: input.organization,
    theme,
    fonts,
    logoSource,
  });

  const output = collectPdfBuffer(document);

  try {
    renderHeader(ctx);

    // Single documents place a title above the header rule and metadata just
    // below it; the combined record has no per-document title, so start the
    // shared header in the body zone to clear the header separator cleanly.
    ctx.cursorY = ctx.bodyStartY;
    // One shared patient/encounter header for the whole combined record.
    renderKeyValueGrid(
      ctx,
      buildClinicalHeaderKeyValue({
        date: input.header.date,
        appointmentId: input.header.appointmentId,
        leadLabel: 'Doctor',
        leadName: input.header.doctorName,
        patientName: input.header.patientName,
        clientName: input.header.clientName,
        clientId: input.header.clientId,
        clientContact: input.header.clientContact,
        speciesBreed: input.header.speciesBreed,
        ageSex: input.header.ageSex,
        roomName: input.header.roomName,
        unitName: input.header.unitName,
        admittedAt: input.header.admittedAt,
        admittedBy: input.header.admittedBy,
      }),
      { columns: 3 }
    );
    renderSpacer(ctx, ctx.theme.spacing.sectionGap);

    input.sections.forEach((section, index) => {
      if (index > 0) {
        renderDivider(ctx);
        renderSpacer(ctx, ctx.theme.spacing.itemGap);
      }
      renderCombinedSection(ctx, section);
    });

    // The single signature lives on its own attestation page at the very end.
    addPageBreak(ctx);
    renderAttestationPage(ctx, input.sections);
    const signaturePlacement = renderDocumentEndBlock(ctx, {
      printedBy: input.printedBy,
      signature: input.signature,
    });

    const pageRange = document.bufferedPageRange();
    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      document.switchToPage(index);
      renderFooter(ctx, index + 1, pageRange.count, ctx.generatedAt);
    }
    document.end();

    const pdf = await output.promise;

    return {
      pdf,
      pageCount: pageRange.count,
      signaturePlacement,
    };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    output.reject(normalizedError);
    throw normalizedError;
  }
};

export const generateCombinedClinicalPdf = async (
  input: CombinedClinicalDocumentInput
): Promise<Buffer> => (await generateCombinedClinicalPdfWithMetadata(input)).pdf;

export const createClinicalPdfContext = (
  document: PdfDocumentInstance,
  organization: PdfGenerationInput['organization']
): PdfContext =>
  (() => {
    const { fonts, theme } = resolveThemeAndFonts(document);
    return new PdfContext({
      document,
      organization,
      theme,
      fonts,
    });
  })();

export const clinicalPdfTheme = buildTheme({
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
});
