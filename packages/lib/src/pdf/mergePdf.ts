import { PDFDocument } from 'pdf-lib';

/**
 * Concatenate multiple PDF byte buffers into a single PDF, preserving page order
 * and adding no extra pages (unlike buildMergedClinicalPacketPdf, which appends a
 * signature/attestation page). Used for "print all" style combined documents.
 *
 * Throws if no buffers are provided or any buffer cannot be parsed as a PDF.
 */
export const mergePdfBuffers = async (buffers: Buffer[]): Promise<Buffer> => {
  if (!buffers.length) {
    throw new Error('Cannot merge an empty list of PDFs');
  }
  const merged = await PDFDocument.create();
  for (const bytes of buffers) {
    const source = await PDFDocument.load(bytes);
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  return Buffer.from(await merged.save());
};
