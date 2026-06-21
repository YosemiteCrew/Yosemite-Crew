import type { PdfContext } from './PdfContext.js';
import { addPageBreak, ensureSpace } from './Pagination.js';
import { renderBulletList } from './sections/BulletList.js';
import { renderDocumentEndBlock } from './sections/DocumentEndBlock.js';
import { renderFooter } from './branding/Footer.js';
import { renderHeader } from './branding/Header.js';
import { renderKeyValueGrid } from './sections/KeyValueGrid.js';
import { renderParagraph, renderDocumentTitle, renderSectionTitle } from './sections/Text.js';
import { renderRichText } from './sections/RichText.js';
import { renderTable } from './sections/Table.js';
import type { DocumentEndBlockInput, KeyValueItem, TableRenderInput } from './types.js';

export class BasePdfTemplate {
  constructor(private readonly ctx: PdfContext) {}

  get context(): PdfContext {
    return this.ctx;
  }

  drawHeader(): void {
    renderHeader(this.ctx);
  }

  drawFooter(pageNumber: number, totalPages: number): void {
    renderFooter(this.ctx, pageNumber, totalPages, this.ctx.generatedAt);
  }

  drawTitle(title: string): void {
    this.ctx.cursorY = this.ctx.titleY;
    renderDocumentTitle(this.ctx, title);
  }

  drawMetadata(groups: KeyValueItem[][]): void {
    this.ctx.cursorY = Math.max(this.ctx.cursorY, this.ctx.metadataY);
    const flattened = groups.flat().filter((field) => field.label.trim().length > 0);
    if (flattened.length > 0) {
      renderKeyValueGrid(this.ctx, flattened, { columns: 3 });
    }
    this.ctx.cursorY = Math.max(this.ctx.cursorY, this.ctx.bodyStartY);
  }

  startBody(): void {
    this.ctx.cursorY = this.ctx.bodyStartY;
  }

  drawSectionTitle(title: string): void {
    renderSectionTitle(this.ctx, title);
  }

  drawParagraph(text: string): void {
    renderParagraph(this.ctx, text);
  }

  drawBullets(items: string[]): void {
    renderBulletList(this.ctx, items);
  }

  drawRichText(value: unknown): void {
    renderRichText(this.ctx, value);
  }

  drawTable(input: TableRenderInput): void {
    renderTable(this.ctx, input);
  }

  ensureSpace(requiredHeight: number): void {
    ensureSpace(this.ctx, requiredHeight);
  }

  addPageWithLayout(): void {
    addPageBreak(this.ctx);
  }

  finalizePageNumbers(): void {
    const pageRange = this.ctx.document.bufferedPageRange();

    for (let index = pageRange.start; index < pageRange.start + pageRange.count; index += 1) {
      this.ctx.document.switchToPage(index);
      renderFooter(this.ctx, index + 1, pageRange.count, this.ctx.generatedAt);
    }
  }

  drawEndBlock(input: DocumentEndBlockInput): ReturnType<typeof renderDocumentEndBlock> {
    return renderDocumentEndBlock(this.ctx, input);
  }
}
