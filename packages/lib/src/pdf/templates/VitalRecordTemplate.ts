import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import { renderDocumentTitle, renderSectionTitle, renderSpacer } from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderRichText } from '../sections/RichText.js';
import { renderTable } from '../sections/Table.js';
import type { ClinicalPdfSignaturePlacement, VitalRecordDocumentData } from '../types.js';
import { buildClinicalHeaderKeyValue, buildKeyValue } from './shared.js';

export const renderVitalRecordTemplate = (
  ctx: PdfContext,
  data: VitalRecordDocumentData
): ClinicalPdfSignaturePlacement => {
  renderDocumentTitle(ctx, data.title);
  renderKeyValueGrid(
    ctx,
    buildClinicalHeaderKeyValue({
      date: data.date,
      appointmentId: data.appointmentId,
      leadLabel: 'Recorded By',
      leadName: data.recordedBy,
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

  renderSectionTitle(ctx, 'Vital Measurements');
  renderTable(ctx, {
    columns: [
      { header: 'Label', width: 0.26 },
      { header: 'Value', width: 0.2, align: 'right' },
      { header: 'Unit', width: 0.16 },
      { header: 'Reference Range', width: 0.24 },
    ],
    rows: data.measurements.map((measurement) => [
      measurement.label,
      measurement.value,
      measurement.unit ?? '',
      measurement.referenceRange ?? '',
    ]),
  });

  if (data.notes) {
    renderSectionTitle(ctx, 'Notes');
    renderRichText(ctx, data.notes);
  }

  if (data.metadata !== undefined) {
    renderSectionTitle(ctx, 'Metadata');
    const metadataEntries = Object.entries(data.metadata as Record<string, unknown>).map(
      ([label, value]) =>
        [label, typeof value === 'string' ? value : JSON.stringify(value ?? '')] as [string, string]
    );
    renderKeyValueGrid(ctx, buildKeyValue(metadataEntries), { columns: 2 });
  }

  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
