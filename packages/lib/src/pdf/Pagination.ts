import { renderHeader } from './branding/Header.js';
import type { PdfContext } from './PdfContext.js';

export const addPageBreak = (ctx: PdfContext): void => {
  ctx.document.addPage();
  renderHeader(ctx);
  ctx.resetCursorForNewPage();
};

export const ensureSpace = (ctx: PdfContext, requiredHeight: number): void => {
  if (ctx.cursorY + requiredHeight <= ctx.contentBottom) {
    return;
  }

  addPageBreak(ctx);
};
