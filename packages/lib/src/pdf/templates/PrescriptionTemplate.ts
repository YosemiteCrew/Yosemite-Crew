import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import { renderDocumentTitle, renderSectionTitle, renderSpacer } from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderTable } from '../sections/Table.js';
import { renderRichText } from '../sections/RichText.js';
import type { ClinicalPdfSignaturePlacement, PrescriptionDocumentData } from '../types.js';
import { buildClinicalHeaderKeyValue } from './shared.js';

// Content sections only (no title, metadata or signature) for combined packets.
export const renderPrescriptionContent = (
  ctx: PdfContext,
  data: PrescriptionDocumentData
): void => {
  renderSectionTitle(ctx, 'Medication Details');
  renderTable(ctx, {
    columns: [
      { header: 'Medication', width: 0.18 },
      { header: 'Strength', width: 0.12 },
      { header: 'Dosage', width: 0.12 },
      { header: 'Frequency', width: 0.12 },
      { header: 'Duration', width: 0.12 },
      { header: 'Qty', width: 0.08, align: 'right' },
      { header: 'Instructions', width: 0.26 },
    ],
    rows: data.items.map((item) => [
      item.medication,
      item.strength ?? '',
      item.dosage ?? '',
      item.frequency ?? '',
      item.duration ?? '',
      item.quantity ?? '',
      item.instructions ?? '',
    ]),
  });

  if (data.notes) {
    renderSectionTitle(ctx, 'Notes');
    renderRichText(ctx, data.notes);
  }
};

// Title + metadata + content, without the signature end block.
export const renderPrescriptionBody = (ctx: PdfContext, data: PrescriptionDocumentData): void => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildClinicalHeaderKeyValue({
      date: data.date,
      appointmentId: data.appointmentId,
      leadLabel: 'Lead',
      leadName: data.leadName,
      patientName: data.patientName,
      clientName: data.clientName,
      clientId: data.clientId,
      clientContact: data.clientContact,
      speciesBreed: data.speciesBreed,
      ageSex: data.ageSex,
    }),
    { columns: 3 }
  );
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  renderPrescriptionContent(ctx, data);
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
};

export const renderPrescriptionTemplate = (
  ctx: PdfContext,
  data: PrescriptionDocumentData
): ClinicalPdfSignaturePlacement => {
  renderPrescriptionBody(ctx, data);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
