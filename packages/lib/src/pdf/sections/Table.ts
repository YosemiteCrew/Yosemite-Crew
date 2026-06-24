import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_SPACING } from '../layout.js';
import type { TableRenderInput } from '../types.js';
import { wrapText } from './Text.js';

const resolveColumnWidths = (ctx: PdfContext, columns: TableRenderInput['columns']): number[] => {
  const explicitWidths = columns.map((column) => column.width ?? 0);
  const explicitTotal = explicitWidths.reduce((sum, width) => sum + width, 0);

  if (explicitTotal > 0 && explicitTotal <= 1.01) {
    // Normalize the fractional widths so the table always spans the full
    // content width — columns summing to e.g. 0.86 are scaled up to fill the
    // row and stay flush with the section rules, instead of stopping short.
    return explicitWidths.map((width) => (ctx.contentWidth * width) / explicitTotal);
  }

  const unspecifiedCount = columns.filter((column) => column.width === undefined).length;
  const remainingWidth = ctx.contentWidth - explicitTotal;
  const fallbackWidth = unspecifiedCount > 0 ? remainingWidth / unspecifiedCount : remainingWidth;

  return explicitWidths.map((width) => (width > 0 ? width : fallbackWidth));
};

export const renderTable = (ctx: PdfContext, input: TableRenderInput): void => {
  const columnWidths = resolveColumnWidths(ctx, input.columns);
  const headerHeight = input.headerHeight ?? 24;
  const rowPaddingY = ctx.theme.spacing.tableCellPaddingY;
  const rowPaddingX = ctx.theme.spacing.tableCellPaddingX;
  const bodyFontSize = PDF_FONT_SIZES.body;
  const minRowHeight = input.rowHeight ?? 28;

  const drawHeader = (): number => {
    ensureSpace(ctx, headerHeight);
    const y = ctx.cursorY;

    ctx.document.save();
    ctx.document.lineWidth(0.75).strokeColor(PDF_COLORS.border).fillColor(PDF_COLORS.panel);

    let x = ctx.contentLeft;
    input.columns.forEach((column, index) => {
      const width = columnWidths[index];
      ctx.document
        .rect(x, y, width, headerHeight)
        .fillAndStroke(PDF_COLORS.panel, PDF_COLORS.border);
      ctx.document
        .font(ctx.theme.fonts.bold)
        .fontSize(PDF_FONT_SIZES.small)
        .fillColor(PDF_COLORS.text)
        .text(column.header, x + rowPaddingX, y + 7, {
          width: width - rowPaddingX * 2,
          align: column.align ?? 'left',
        });
      x += width;
    });

    ctx.document.restore();
    ctx.moveDown(headerHeight);
    return y;
  };

  drawHeader();

  for (const row of input.rows) {
    const beforeEnsureY = ctx.cursorY;
    const cellHeights = row.map((cell, index) => {
      const width = Math.max(12, columnWidths[index] - rowPaddingX * 2);
      const lines = wrapText(ctx, cell, width, bodyFontSize);
      const lineHeight = Math.ceil(bodyFontSize * 1.32 + 2);
      return lines.length * lineHeight + rowPaddingY * 2;
    });
    const rowHeight = Math.max(minRowHeight, ...cellHeights);
    ensureSpace(ctx, rowHeight);

    if (ctx.cursorY === ctx.contentTop && beforeEnsureY !== ctx.contentTop) {
      drawHeader();
    }

    const y = ctx.cursorY;
    let x = ctx.contentLeft;

    ctx.document.save();
    ctx.document.lineWidth(0.75).strokeColor(PDF_COLORS.border);

    row.forEach((cell, index) => {
      const width = columnWidths[index];
      ctx.document.rect(x, y, width, rowHeight).stroke();
      ctx.document
        .font(ctx.theme.fonts.regular)
        .fontSize(bodyFontSize)
        .fillColor(PDF_COLORS.text)
        .text(cell, x + rowPaddingX, y + rowPaddingY, {
          width: width - rowPaddingX * 2,
          align: input.columns[index]?.align ?? 'left',
          lineGap: 2,
        });
      x += width;
    });

    ctx.document.restore();
    ctx.moveDown(rowHeight);
  }

  // Trailing gap so following content (a section heading's own leading gap adds
  // to this, or totals/text that have none) clears the table's bottom border
  // instead of sitting flush against it.
  ctx.moveDown(PDF_SPACING.sectionGap - PDF_SPACING.paragraphGap);
};
