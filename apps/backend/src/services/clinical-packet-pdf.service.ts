// PDF merge logic now lives in @yosemite-crew/lib alongside the pdfkit
// generators (pdf-lib for merge/parse, pdfkit for generation — complementary).
// This service is the backend composition root: it binds the default document
// loader (the persisted rendered-document pipeline) so callers keep the same
// zero-arg ergonomics, and re-exports the shared types/error.
import {
  buildMergedClinicalPacketPdf as buildMergedClinicalPacketPdfCore,
  type BuildMergedClinicalPacketPdfInput,
  type MergedClinicalPacketPdf,
  type PacketDocumentPdfLoader,
} from "@yosemite-crew/lib";
import { getPersistedRenderedDocumentPdf } from "src/services/rendered-document.service";

export {
  ClinicalPacketPdfError,
  type BuildMergedClinicalPacketPdfInput,
  type MergedClinicalPacketPdf,
  type MergedPacketDocument,
  type PacketDocumentPdfLoader,
} from "@yosemite-crew/lib";

/**
 * Default loader: pulls a document's PDF bytes from the persisted
 * rendered-document pipeline.
 */
const defaultDocumentPdfLoader: PacketDocumentPdfLoader = async (
  documentId,
  organisationId,
) => {
  const result = await getPersistedRenderedDocumentPdf(
    documentId,
    organisationId,
  );
  return result.pdf;
};

/**
 * Merge the per-document PDFs of a packet into a single PDF and append one
 * attestation/signature page. Delegates to the shared @yosemite-crew/lib helper,
 * defaulting the document loader to the persisted rendered-document pipeline.
 */
export const buildMergedClinicalPacketPdf = (
  input: BuildMergedClinicalPacketPdfInput,
  loadDocumentPdf: PacketDocumentPdfLoader = defaultDocumentPdfLoader,
): Promise<MergedClinicalPacketPdf> =>
  buildMergedClinicalPacketPdfCore(input, loadDocumentPdf);
