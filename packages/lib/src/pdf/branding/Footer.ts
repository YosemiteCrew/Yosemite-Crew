import type { PdfContext } from '../PdfContext.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_LAYOUT } from '../layout.js';

const formatTimestamp = (date: Date, timeZone?: string): string => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...(timeZone ? { timeZone, timeZoneName: 'short' as const } : {}),
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const dayPeriod = get('dayPeriod').toUpperCase();
  const datePart = `${get('day')} ${get('month')}, ${get('year')}`.trim();
  const timePart = `${get('hour')}:${get('minute')} ${dayPeriod}`.trim();
  const zone = get('timeZoneName');

  return `${zone ? `${zone} ` : ''}${datePart} ${timePart}`.trim();
};

export const renderFooter = (
  ctx: PdfContext,
  pageNumber: number,
  totalPages: number,
  generatedAt: Date = ctx.generatedAt
): void => {
  const { document } = ctx;
  const leftX = PDF_LAYOUT.marginX;
  const rightX = ctx.pageWidth - PDF_LAYOUT.marginX;
  const leftWidth = Math.max(220, ctx.pageWidth - PDF_LAYOUT.marginX * 2 - 190);
  const footerTop = PDF_LAYOUT.footerTextY;
  const footerBottom = PDF_LAYOUT.footerTimestampY;

  document.save();

  document
    .moveTo(PDF_LAYOUT.marginX, PDF_LAYOUT.footerSeparatorY)
    .lineTo(ctx.pageWidth - PDF_LAYOUT.marginX, PDF_LAYOUT.footerSeparatorY)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.border)
    .stroke();

  const footerLeftLines = [
    ctx.organization.name,
    ctx.organization.addressLine1,
    ctx.organization.addressLine2,
    ctx.organization.legalName,
    ctx.organization.footerText,
  ].filter((line): line is string => Boolean(line && line.trim()));

  document
    .font(ctx.theme.fonts.bold)
    .fontSize(PDF_FONT_SIZES.footer)
    .fillColor(PDF_COLORS.text)
    .text(footerLeftLines[0] ?? ctx.organization.name, leftX, footerTop, {
      width: leftWidth,
      lineGap: 2,
    });

  if (footerLeftLines.length > 1) {
    document
      .font(ctx.theme.fonts.regular)
      .fontSize(9)
      .fillColor(PDF_COLORS.muted)
      .text(footerLeftLines.slice(1).join('\n'), leftX, footerTop + 12, {
        width: leftWidth,
        lineGap: 1.5,
      });
  }

  document
    .font(ctx.theme.fonts.bold)
    .fontSize(PDF_FONT_SIZES.pageNumber)
    .fillColor(PDF_COLORS.text)
    .text(`Page ${pageNumber} of ${totalPages}`, rightX - 140, footerTop, {
      width: 140,
      align: 'right',
    });

  document
    .font(ctx.theme.fonts.regular)
    .fontSize(9)
    .fillColor(PDF_COLORS.muted)
    .text(formatTimestamp(generatedAt, ctx.organization.timezone), rightX - 170, footerBottom, {
      width: 170,
      align: 'right',
    });

  document.restore();
};
