import type { PdfContext } from '../PdfContext.js';
import { renderKeyValueGrid } from '../sections/KeyValueGrid.js';
import {
  renderDocumentTitle,
  renderSectionTitle,
  renderSpacer,
  renderSubTitle,
} from '../sections/Text.js';
import { renderDocumentEndBlock } from '../sections/DocumentEndBlock.js';
import { renderRichText } from '../sections/RichText.js';
import { renderTable } from '../sections/Table.js';
import type { ClinicalPdfSignaturePlacement, VitalRecordDocumentData } from '../types.js';
import { buildClinicalHeaderKeyValue, buildKeyValue } from './shared.js';

// Content sections only (no title, metadata or signature) for combined packets.
export const renderVitalRecordContent = (ctx: PdfContext, data: VitalRecordDocumentData): void => {
  const recordedLine = [
    data.recordedBy ? `Recorded by ${data.recordedBy}` : undefined,
    data.recordedAt ? `on ${data.recordedAt}` : undefined,
  ]
    .filter(Boolean)
    .join(' ');
  if (recordedLine) {
    renderSubTitle(ctx, recordedLine);
  }

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
};

// Title + metadata + content, without the signature end block.
export const renderVitalRecordBody = (ctx: PdfContext, data: VitalRecordDocumentData): void => {
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
  renderVitalRecordContent(ctx, data);
  renderSpacer(ctx, ctx.theme.spacing.sectionGap);
};

export const renderVitalRecordTemplate = (
  ctx: PdfContext,
  data: VitalRecordDocumentData
): ClinicalPdfSignaturePlacement => {
  renderVitalRecordBody(ctx, data);
  return renderDocumentEndBlock(ctx, {
    printedBy: data.printedBy,
    signature: data.signature,
  });
};
