import PDFDocument from 'pdfkit';
import type { OrganizationBranding, PdfTheme } from './types.js';
import { PDF_LAYOUT, PDF_PAGE_SIZE } from './layout.js';
import type { PdfFontFamilies } from './fonts.js';

export type PdfDocumentInstance = InstanceType<typeof PDFDocument>;

export type PdfMargins = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type PdfContextConfig = {
  document: PdfDocumentInstance;
  organization: OrganizationBranding;
  theme: PdfTheme;
  fonts?: PdfFontFamilies;
  margins?: Partial<PdfMargins>;
  headerHeight?: number;
  footerHeight?: number;
  generatedAt?: Date;
  logoSource?: string | Buffer | null;
};

export class PdfContext {
  public readonly document: PdfDocumentInstance;
  public readonly organization: OrganizationBranding;
  public readonly theme: PdfTheme;
  public readonly fonts?: PdfFontFamilies;
  public readonly pageWidth: number;
  public readonly pageHeight: number;
  public readonly margins: PdfMargins;
  public readonly headerHeight: number;
  public readonly footerHeight: number;
  public readonly generatedAt: Date;
  public readonly logoSource?: string | Buffer | null;
  public readonly titleY: number;
  public readonly metadataY: number;
  public readonly bodyStartY: number;
  public readonly headerSeparatorY: number;
  public readonly footerSeparatorY: number;
  public readonly footerTextY: number;
  public readonly footerTimestampY: number;
  public cursorY: number;

  constructor(config: PdfContextConfig) {
    this.document = config.document;
    this.organization = config.organization;
    this.theme = config.theme;
    this.fonts = config.fonts;
    this.pageWidth = this.document.page?.width ?? PDF_PAGE_SIZE.width;
    this.pageHeight = this.document.page?.height ?? PDF_PAGE_SIZE.height;
    this.margins = {
      left: config.margins?.left ?? this.theme.spacing.pageMarginX,
      right: config.margins?.right ?? this.theme.spacing.pageMarginX,
      top: config.margins?.top ?? 0,
      bottom: config.margins?.bottom ?? 0,
    };
    this.headerHeight = config.headerHeight ?? this.theme.spacing.headerHeight;
    this.footerHeight = config.footerHeight ?? this.theme.spacing.footerHeight;
    this.generatedAt = config.generatedAt ?? new Date();
    this.logoSource = config.logoSource;
    this.titleY = PDF_LAYOUT.titleY;
    this.metadataY = PDF_LAYOUT.metadataY;
    this.bodyStartY = this.contentTop;
    this.headerSeparatorY = PDF_LAYOUT.headerSeparatorY;
    this.footerSeparatorY = PDF_LAYOUT.footerSeparatorY;
    this.footerTextY = PDF_LAYOUT.footerTextY;
    this.footerTimestampY = PDF_LAYOUT.footerTimestampY;
    this.cursorY = this.titleY;
  }

  get contentLeft(): number {
    return this.margins.left;
  }

  get contentRight(): number {
    return this.pageWidth - this.margins.right;
  }

  get contentWidth(): number {
    return this.contentRight - this.contentLeft;
  }

  get contentTop(): number {
    return PDF_LAYOUT.bodyStartY;
  }

  get contentBottom(): number {
    return PDF_LAYOUT.footerSeparatorY;
  }

  moveDown(points: number): void {
    this.cursorY = Math.min(this.contentBottom, this.cursorY + points);
  }

  resetCursorForNewPage(): void {
    this.cursorY = this.contentTop;
  }

  resetCursorForDocumentStart(): void {
    this.cursorY = this.titleY;
  }
}
