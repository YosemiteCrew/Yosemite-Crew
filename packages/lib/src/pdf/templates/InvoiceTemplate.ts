import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import { renderDocumentTitle, renderSectionTitle, renderSpacer } from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderTable } from '../sections/Table.js';
import type { ClinicalPdfSignaturePlacement, InvoiceDocumentData } from '../types.js';
import { buildKeyValue, formatDateValue, formatMoney } from './shared.js';
import { ensureSpace } from '../Pagination.js';
import { renderRichText } from '../sections/RichText.js';

export const renderInvoiceTemplate = (
  ctx: PdfContext,
  data: InvoiceDocumentData
): ClinicalPdfSignaturePlacement => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildKeyValue([
      ['Invoice Number', data.invoiceNumber],
      ['Date', formatDateValue(data.date)],
      ['Due Date', data.dueDate ? formatDateValue(data.dueDate) : undefined],
      ['Client', data.clientName],
      ['Client ID', data.clientId],
      ['Patient', data.patientName],
      ['Doctor', data.doctorName],
    ]),
    { columns: 3 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);

  renderSectionTitle(ctx, 'Invoice Items');
  renderTable(ctx, {
    columns: [
      { header: 'Name', width: 0.2 },
      { header: 'Description', width: 0.35 },
      { header: 'Qty', width: 0.1, align: 'right' },
      { header: 'Unit Price', width: 0.17, align: 'right' },
      { header: 'Total', width: 0.18, align: 'right' },
    ],
    rows: data.items.map((item) => [
      item.name,
      item.description ?? '',
      String(item.quantity),
      formatMoney(data.currency, item.unitPrice),
      formatMoney(data.currency, item.total),
    ]),
  });

  renderSpacer(ctx, 10);

  const totals: Array<[string, number]> = [
    ['Subtotal', data.subtotal],
    ['Discount', data.discount ?? 0],
    ['Tax', data.tax ?? 0],
    ['Grand Total', data.grandTotal],
    ['Amount Paid', data.amountPaid ?? 0],
    ['Balance Due', data.balanceDue ?? Math.max(0, data.grandTotal - (data.amountPaid ?? 0))],
  ];

  const totalLabelWidth = 100;
  const totalValueWidth = 130;
  const totalX = ctx.contentRight - totalLabelWidth - totalValueWidth;
  const totalLineHeight = 18;
  const totalBlockHeight = totals.length * totalLineHeight + 10;
  ensureSpace(ctx, totalBlockHeight);

  ctx.document.save();
  ctx.document
    .font(ctx.theme.fonts.bold)
    .fontSize(ctx.theme.fontSizes.body)
    .fillColor(ctx.theme.colors.text);

  totals.forEach(([label, value], index) => {
    const y = ctx.cursorY + index * totalLineHeight;
    ctx.document.text(label, totalX, y, { width: totalLabelWidth, align: 'right' });
    ctx.document.text(formatMoney(data.currency, value), totalX + totalLabelWidth, y, {
      width: totalValueWidth,
      align: 'right',
    });
  });
  ctx.document.restore();
  ctx.moveDown(totalBlockHeight);

  if (data.paymentNotes) {
    renderSectionTitle(ctx, 'Payment Notes');
    renderRichText(ctx, data.paymentNotes);
  }

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
