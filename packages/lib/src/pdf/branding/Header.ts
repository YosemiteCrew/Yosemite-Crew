import type { PdfContext } from '../PdfContext.js';
import { PDF_COLORS, PDF_FONT_SIZES, PDF_LAYOUT } from '../layout.js';

const HEADER_LOGO_SIZE = 44;

export const renderHeader = (ctx: PdfContext): void => {
  const { document } = ctx;
  const logoX = PDF_LAYOUT.headerLogo.x;
  const logoY = PDF_LAYOUT.headerLogo.y;
  const textX = logoX + HEADER_LOGO_SIZE + 14;
  const rightX = ctx.pageWidth - PDF_LAYOUT.marginX;

  document.save();

  if (ctx.logoSource) {
    document.image(ctx.logoSource, logoX, logoY, {
      fit: [HEADER_LOGO_SIZE, HEADER_LOGO_SIZE],
      align: 'center',
      valign: 'center',
    });
  } else {
    document
      .lineWidth(1)
      .strokeColor(PDF_COLORS.border)
      .fillColor(PDF_COLORS.panel)
      .rect(logoX, logoY, HEADER_LOGO_SIZE, HEADER_LOGO_SIZE)
      .fillAndStroke(PDF_COLORS.panel, PDF_COLORS.border);
  }

  document
    .fillColor(PDF_COLORS.text)
    .font(ctx.theme.fonts.bold)
    .fontSize(PDF_FONT_SIZES.headerOrg)
    .text(ctx.organization.name, textX, PDF_LAYOUT.headerOrgY, {
      width: ctx.pageWidth - PDF_LAYOUT.marginX * 2 - HEADER_LOGO_SIZE - 160,
      ellipsis: true,
    });

  const addressLines = [ctx.organization.addressLine1, ctx.organization.addressLine2].filter(
    Boolean
  );

  document
    .fillColor(PDF_COLORS.muted)
    .font(ctx.theme.fonts.regular)
    .fontSize(PDF_FONT_SIZES.headerContact)
    .text(addressLines.join('\n'), textX, PDF_LAYOUT.headerOrgY + 17, {
      width: ctx.pageWidth - PDF_LAYOUT.marginX * 2 - HEADER_LOGO_SIZE - 160,
      lineGap: 2,
    });

  const contactLines = [
    ctx.organization.phone ? `Phone: ${ctx.organization.phone}` : undefined,
    ctx.organization.email ? `Email: ${ctx.organization.email}` : undefined,
  ].filter((value): value is string => Boolean(value));

  document
    .font(ctx.theme.fonts.regular)
    .fontSize(PDF_FONT_SIZES.headerContact)
    .fillColor(PDF_COLORS.text)
    .text(contactLines.join('\n'), PDF_LAYOUT.headerContactX, PDF_LAYOUT.headerContactY + 2, {
      width: rightX - PDF_LAYOUT.headerContactX,
      align: 'right',
      lineGap: 2,
    });

  document
    .moveTo(PDF_LAYOUT.marginX, PDF_LAYOUT.headerSeparatorY)
    .lineTo(ctx.pageWidth - PDF_LAYOUT.marginX, PDF_LAYOUT.headerSeparatorY)
    .lineWidth(1)
    .strokeColor(PDF_COLORS.border)
    .stroke();

  document.restore();
};
