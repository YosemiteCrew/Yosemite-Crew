import type { PdfContext } from '../PdfContext.js';
import { renderBulletList } from '../sections/BulletList.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import { renderDocumentTitle, renderSectionTitle, renderSpacer } from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderRichText } from '../sections/RichText.js';
import type { ClinicalPdfSignaturePlacement, DischargeSummaryDocumentData } from '../types.js';
import { buildClinicalHeaderKeyValue } from './shared.js';

// Content sections only (no title, metadata or signature) for combined packets.
export const renderDischargeSummaryContent = (
  ctx: PdfContext,
  data: DischargeSummaryDocumentData
): void => {
  renderSectionTitle(ctx, 'Chief Complaint');
  renderRichText(ctx, data.chiefComplaint);

  renderSectionTitle(ctx, 'Treatment Summary');
  renderRichText(ctx, data.treatmentSummary);

  renderSectionTitle(ctx, 'Procedures');
  renderBulletList(ctx, data.procedures);

  renderSectionTitle(ctx, 'Diagnostics');
  renderBulletList(ctx, data.diagnostics);

  renderSectionTitle(ctx, 'Discharge Summary');
  renderRichText(ctx, data.dischargeSummary);

  renderSectionTitle(ctx, 'Home Care');
  renderBulletList(ctx, data.homeCare);

  renderSectionTitle(ctx, 'Emergency Care');
  renderBulletList(ctx, data.emergencyCare);

  renderSectionTitle(ctx, 'Emergency Contact');
  renderRichText(ctx, data.emergencyContact);
};

// Title + metadata + content, without the signature end block.
export const renderDischargeSummaryBody = (
  ctx: PdfContext,
  data: DischargeSummaryDocumentData
): void => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildClinicalHeaderKeyValue({
      date: data.date,
      appointmentId: data.appointmentId,
      leadLabel: 'Doctor',
      leadName: data.doctorName,
      patientName: data.patientName,
      clientName: data.clientName,
      clientId: data.clientId,
      clientContact: data.contact,
      speciesBreed: data.speciesBreed,
      ageSex: data.ageSex,
    }),
    { columns: 3 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  renderDischargeSummaryContent(ctx, data);
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
};

export const renderDischargeSummaryTemplate = (
  ctx: PdfContext,
  data: DischargeSummaryDocumentData
): ClinicalPdfSignaturePlacement => {
  renderDischargeSummaryBody(ctx, data);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
