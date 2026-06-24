import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_SPACING } from '../layout.js';
import { measureWrappedText, wrapText } from './Text.js';

export const renderBulletList = (ctx: PdfContext, items: string[]): void => {
  const bulletGap = 12;
  const textWidth = ctx.contentWidth - bulletGap;
  const fontSize = PDF_FONT_SIZES.body;
  const lineHeight = Math.ceil(fontSize * 1.35 + 2);

  for (const item of items) {
    const lines = wrapText(ctx, item, textWidth, fontSize);
    const estimatedHeight = Math.max(
      lineHeight,
      measureWrappedText(ctx, item, textWidth, { fontSize }).lines.length * lineHeight
    );
    ensureSpace(ctx, estimatedHeight);

    ctx.document.save().font(ctx.theme.fonts.regular).fontSize(fontSize).fillColor(PDF_COLORS.text);

    lines.forEach((line, index) => {
      const y = ctx.cursorY;
      const bulletX = ctx.contentLeft;
      const textX = ctx.contentLeft + bulletGap;

      ctx.document.text(index === 0 ? '•' : '', bulletX, y, {
        width: bulletGap,
      });
      ctx.document.text(line, textX, y, {
        width: textWidth,
      });
      ctx.moveDown(lineHeight);
    });

    ctx.document.restore();
    ctx.moveDown(PDF_SPACING.itemGap);
  }
};
