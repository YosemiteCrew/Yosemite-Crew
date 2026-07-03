import type { PdfContext } from '../PdfContext.js';
import { ensureSpace } from '../Pagination.js';
import { PDF_COLORS } from '../layout.js';
import { renderDocumentTitle, renderSpacer } from '../sections/Text.js';
import type {
  ClinicalPdfSignaturePlacement,
  PrescriptionItem,
  PrescriptionLabelDocumentData,
} from '../types.js';

const LABEL_CARD_PADDING = 12;
const LABEL_CARD_GAP = 14;
const CONTROLLED_BANNER_HEIGHT = 22;

const formatLabelDate = (date: Date): string => {
  try {
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const joinDirections = (item: PrescriptionItem): string =>
  [item.dosage, item.route, item.frequency, item.duration]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' • ');

const drawLabelLine = (
  ctx: PdfContext,
  label: string,
  value: string,
  x: number,
  width: number
): void => {
  const fontSize = ctx.theme.fontSizes.small;
  const lineHeight = Math.ceil(fontSize * 1.4 + 2);
  ensureSpace(ctx, lineHeight);

  const labelText = `${label}: `;
  ctx.document.save().font(ctx.theme.fonts.bold).fontSize(fontSize).fillColor(PDF_COLORS.muted);
  const labelWidth = ctx.document.widthOfString(labelText);
  ctx.document.text(labelText, x, ctx.cursorY, { width, continued: false });

  ctx.document
    .font(ctx.theme.fonts.regular)
    .fillColor(PDF_COLORS.text)
    .text(value || '—', x + labelWidth, ctx.cursorY, {
      width: Math.max(0, width - labelWidth),
    })
    .restore();

  ctx.moveDown(lineHeight);
};

const renderControlledBanner = (ctx: PdfContext, x: number, width: number): void => {
  ensureSpace(ctx, CONTROLLED_BANNER_HEIGHT + 4);
  const y = ctx.cursorY;

  ctx.document
    .save()
    .rect(x, y, width, CONTROLLED_BANNER_HEIGHT)
    .fill(PDF_COLORS.text)
    .fillColor('#FFFFFF')
    .font(ctx.theme.fonts.bold)
    .fontSize(ctx.theme.fontSizes.small)
    .text('CONTROLLED SUBSTANCE', x, y + 6, {
      width,
      align: 'center',
    })
    .restore();

  ctx.moveDown(CONTROLLED_BANNER_HEIGHT + 6);
};

const renderLabelCard = (ctx: PdfContext, item: PrescriptionItem): void => {
  const x = ctx.contentLeft;
  const width = ctx.contentWidth;
  const innerX = x + LABEL_CARD_PADDING;
  const innerWidth = width - LABEL_CARD_PADDING * 2;
  const cardTop = ctx.cursorY;

  ctx.moveDown(LABEL_CARD_PADDING);

  if (item.controlled) {
    renderControlledBanner(ctx, innerX, innerWidth);
  }

  const medicationLine = [item.medication, item.strength]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');

  const headingHeight = Math.ceil(ctx.theme.fontSizes.sectionTitle * 1.4 + 4);
  ensureSpace(ctx, headingHeight);
  ctx.document
    .save()
    .font(ctx.theme.fonts.bold)
    .fontSize(ctx.theme.fontSizes.sectionTitle)
    .fillColor(PDF_COLORS.text)
    .text(medicationLine || '—', innerX, ctx.cursorY, { width: innerWidth })
    .restore();
  ctx.moveDown(headingHeight);

  drawLabelLine(ctx, 'Directions', joinDirections(item), innerX, innerWidth);
  drawLabelLine(ctx, 'Quantity', item.quantity ?? '', innerX, innerWidth);
  if (item.instructions) {
    drawLabelLine(ctx, 'Instructions', item.instructions, innerX, innerWidth);
  }

  ctx.moveDown(LABEL_CARD_PADDING);

  const cardBottom = ctx.cursorY;
  ctx.document
    .save()
    .roundedRect(x, cardTop, width, cardBottom - cardTop, 6)
    .lineWidth(1)
    .strokeColor(item.controlled ? PDF_COLORS.text : PDF_COLORS.border)
    .stroke()
    .restore();

  ctx.moveDown(LABEL_CARD_GAP);
};

export const renderPrescriptionLabelTemplate = (
  ctx: PdfContext,
  data: PrescriptionLabelDocumentData
): ClinicalPdfSignaturePlacement => {
  renderDocumentTitle(ctx, data.title);

  const x = ctx.contentLeft;
  const width = ctx.contentWidth;

  drawLabelLine(ctx, 'Patient', data.patientName, x, width);
  drawLabelLine(ctx, 'Client', data.clientName, x, width);
  drawLabelLine(ctx, 'Prescriber', data.prescriberName, x, width);
  drawLabelLine(ctx, 'Clinic', data.organisationName, x, width);
  drawLabelLine(ctx, 'Date', formatLabelDate(data.date), x, width);
  if (data.prescriptionId) {
    drawLabelLine(ctx, 'Rx ID', data.prescriptionId, x, width);
  }

  renderSpacer(ctx, ctx.theme.spacing.itemGap + 6);

  for (const item of data.items) {
    renderLabelCard(ctx, item);
  }

  return {
    pageNumber: 1,
    pageX: ctx.contentLeft,
    pageY: ctx.cursorY,
    width: 0,
    height: 0,
  };
};
