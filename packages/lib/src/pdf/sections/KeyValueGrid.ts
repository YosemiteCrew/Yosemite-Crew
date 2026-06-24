import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_SPACING } from '../layout.js';
import type { KeyValueItem } from '../types.js';
import { measureWrappedText, wrapText } from './Text.js';

export type KeyValueGridOptions = {
  columns?: number;
  labelWidth?: number;
  valueFontSize?: number;
};

export const renderKeyValueGrid = (
  ctx: PdfContext,
  fields: KeyValueItem[],
  options: KeyValueGridOptions = {}
): void => {
  const columns = Math.max(1, options.columns ?? 2);
  const columnWidth = ctx.contentWidth / columns;
  const labelWidth = options.labelWidth ?? Math.min(130, columnWidth * 0.42);
  const valueWidth = columnWidth - labelWidth - 10;
  const valueFontSize = options.valueFontSize ?? ctx.theme.fontSizes.body;
  const labelFontSize = PDF_FONT_SIZES.metadataLabel;
  const lineHeight = Math.ceil(valueFontSize * 1.32 + 2);
  const labelHeight = Math.ceil(labelFontSize * 1.25 + 2);

  for (let index = 0; index < fields.length; index += columns) {
    const row = fields.slice(index, index + columns);
    const cellHeights = row.map((field) => {
      const valueLines = wrapText(ctx, field.value, valueWidth, valueFontSize);
      return valueLines.length * lineHeight + labelHeight + 10;
    });
    const rowHeight = Math.max(...cellHeights);
    ensureSpace(ctx, rowHeight);

    row.forEach((field, columnIndex) => {
      const x = ctx.contentLeft + columnIndex * columnWidth;
      const y = ctx.cursorY;
      const valueLines = measureWrappedText(ctx, field.value, valueWidth, {
        fontSize: valueFontSize,
      }).lines;

      ctx.document
        .save()
        .font(ctx.theme.fonts.regular)
        .fontSize(labelFontSize)
        .fillColor(PDF_COLORS.muted)
        .text(field.label, x, y, {
          width: columnWidth - 6,
        })
        .font(ctx.theme.fonts.regular)
        .fontSize(valueFontSize)
        .fillColor(PDF_COLORS.text);

      ctx.document.text(valueLines.join('\n'), x, y + labelHeight + 2, {
        width: valueWidth,
        lineGap: 2,
      });

      ctx.document.restore();
    });

    ctx.moveDown(rowHeight + PDF_SPACING.itemGap);
  }
};
