import { PDFDocument, StandardFonts } from "pdf-lib";

// Renders an attested passport clinical record to a single-page PDF so it can be
// e-signed through the existing Documenso flow. Kept deliberately simple and
// kind-agnostic: the caller supplies the title + the label/value fields.
export type RecordPdfField = { label: string; value: string };

export const buildPassportRecordPdf = async (input: {
  title: string;
  subtitle?: string;
  fields: RecordPdfField[];
}): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const left = 56;
  let y = 780;

  page.drawText(input.title, { x: left, y, size: 18, font: bold });
  y -= 24;
  if (input.subtitle) {
    page.drawText(input.subtitle, { x: left, y, size: 11, font });
    y -= 30;
  } else {
    y -= 14;
  }

  for (const field of input.fields) {
    if (y < 180) break;
    page.drawText(`${field.label}:`, { x: left, y, size: 11, font: bold });
    page.drawText(field.value, { x: left + 160, y, size: 11, font });
    y -= 20;
  }

  page.drawText("Veterinarian signature:", {
    x: left,
    y: 140,
    size: 11,
    font: bold,
  });
  page.drawText(
    "Digital pet health record. Not a legal substitute for the official travel document.",
    { x: left, y: 56, size: 8, font },
  );

  const bytes = await doc.save();
  return Buffer.from(bytes);
};
