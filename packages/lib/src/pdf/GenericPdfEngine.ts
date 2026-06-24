import fs from 'node:fs';
import axios from 'axios';
import PDFDocument from 'pdfkit';
import { registerPdfFonts } from './fonts.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_LAYOUT, PDF_PAGE_SIZE, PDF_SPACING } from './layout.js';
import { BasePdfTemplate } from './BasePdfTemplate.js';
import { PdfContext } from './PdfContext.js';
import type { PdfDocumentInstance } from './PdfContext.js';
import type {
  ClinicalPdfRenderResult,
  GeneratePdfInput,
  GenericInvoiceRenderData,
  PdfTheme,
} from './types.js';
import { buildKeyValue } from './templates/shared.js';

const buildTheme = (fonts: ReturnType<typeof registerPdfFonts>): PdfTheme => ({
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
  });

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
    document.on('end', () => resolve(Buffer.concat(chunks)));
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

  return fs.existsSync(logoUrl) ? logoUrl : null;
};

const renderInvoiceSummary = (
  template: BasePdfTemplate,
  invoice: GenericInvoiceRenderData,
  currency = 'USD'
): void => {
  template.drawSectionTitle('Invoice Items');
  template.drawTable({
    columns: [
      { header: 'Name', width: 0.2 },
      { header: 'Description', width: 0.35 },
      { header: 'Qty', width: 0.1, align: 'right' },
      { header: 'Unit Price', width: 0.17, align: 'right' },
      { header: 'Total', width: 0.18, align: 'right' },
    ],
    rows: invoice.items.map((item) => [
      item.name,
      item.description ?? '',
      String(item.quantity),
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(item.unitPrice),
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(item.total),
    ]),
  });

  template.ensureSpace(72);
  const totals = buildKeyValue([
    [
      'Subtotal',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(invoice.subtotal),
    ],
    [
      'Discount',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(invoice.discount ?? 0),
    ],
    [
      'Tax',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(invoice.tax ?? 0),
    ],
    [
      'Grand Total',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(invoice.grandTotal),
    ],
    [
      'Amount Paid',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
        invoice.amountPaid ?? 0
      ),
    ],
    [
      'Balance Due',
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
        invoice.balanceDue ?? Math.max(0, invoice.grandTotal - (invoice.amountPaid ?? 0))
      ),
    ],
  ]);
  template.context.cursorY = Math.min(
    template.context.cursorY,
    template.context.contentBottom - 80
  );
  template.drawMetadata([totals]);
};

export const generatePdf = async (input: GeneratePdfInput): Promise<Buffer> => {
  return (await generatePdfWithMetadata(input)).pdf;
};

export const generatePdfWithMetadata = async (
  input: GeneratePdfInput
): Promise<ClinicalPdfRenderResult> => {
  const document = createDocument();
  const fonts = registerPdfFonts(document);
  const theme = buildTheme(fonts);
  const logoSource = await resolveLogoSource(input.organization.logoUrl ?? null);
  const ctx = new PdfContext({
    document,
    organization: input.organization,
    theme,
    fonts,
    logoSource,
  });
  const template = new BasePdfTemplate(ctx);
  const output = collectPdfBuffer(document);

  try {
    template.drawHeader();
    template.drawTitle(input.title);
    if (input.metadataGroups?.length) {
      template.drawMetadata(input.metadataGroups);
    } else {
      template.startBody();
    }

    for (const section of input.sections) {
      template.drawSectionTitle(section.title);
      for (const content of section.content) {
        switch (content.type) {
          case 'paragraph':
            template.drawParagraph(content.text);
            break;
          case 'bullets':
            template.drawBullets(content.items);
            break;
          case 'richText':
            template.drawRichText({ runs: content.runs });
            break;
          case 'table':
            template.drawTable(content);
            break;
          default: {
            const exhaustiveCheck: never = content;
            throw new Error(`Unsupported section content: ${String(exhaustiveCheck)}`);
          }
        }
      }
    }

    if (input.invoice) {
      renderInvoiceSummary(template, input.invoice);
    }

    const signaturePlacement = template.drawEndBlock({
      printedBy: input.printedBy,
      signature: input.signature,
    });
    template.finalizePageNumbers();
    document.end();

    const pdf = await output.promise;
    const pageRange = document.bufferedPageRange();

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
