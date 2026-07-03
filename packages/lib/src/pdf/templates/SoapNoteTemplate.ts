import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import { renderDocumentTitle, renderSectionTitle, renderSpacer } from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderRichText } from '../sections/RichText.js';
import type { ClinicalPdfSignaturePlacement, SoapNoteDocumentData } from '../types.js';
import { buildClinicalHeaderKeyValue } from './shared.js';

// Content sections only (no title, metadata or signature) so a combined
// clinical packet can render them under one shared header and sign once.
export const renderSoapNoteContent = (ctx: PdfContext, data: SoapNoteDocumentData): void => {
  renderSectionTitle(ctx, 'Subjective');
  renderRichText(ctx, data.subjective);

  renderSectionTitle(ctx, 'Objective');
  renderRichText(ctx, data.objective);

  renderSectionTitle(ctx, 'Assessment');
  renderRichText(ctx, data.assessment);

  renderSectionTitle(ctx, 'Plan');
  renderRichText(ctx, data.plan);
};

// Title + metadata + content, without the signature end block (standalone
// rendering appends the end block below).
export const renderSoapNoteBody = (ctx: PdfContext, data: SoapNoteDocumentData): void => {
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
      speciesBreed: data.speciesBreed,
      ageSex: data.ageSex,
    }),
    { columns: 3 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  renderSoapNoteContent(ctx, data);
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
};

export const renderSoapNoteTemplate = (
  ctx: PdfContext,
  data: SoapNoteDocumentData
): ClinicalPdfSignaturePlacement => {
  renderSoapNoteBody(ctx, data);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
