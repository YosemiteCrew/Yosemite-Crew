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
  PdfGenerationInput,
  PdfTheme,
} from './types.js';
import { renderDischargeSummaryTemplate } from './templates/DischargeSummaryTemplate.js';
import { renderInvoiceTemplate } from './templates/InvoiceTemplate.js';
import { renderPrescriptionTemplate } from './templates/PrescriptionTemplate.js';
import { renderSoapNoteTemplate } from './templates/SoapNoteTemplate.js';
import { renderVitalRecordTemplate } from './templates/VitalRecordTemplate.js';

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
