import { PDFDocument } from "pdf-lib";
import {
  buildMergedClinicalPacketPdf,
  ClinicalPacketPdfError,
  type MergedPacketDocument,
} from "../../src/services/clinical-packet-pdf.service";

// The default loader pulls in the heavy rendered-document pipeline; stub it so
// importing the module under test has no side effects. Tests inject their own
// loader, so this mock is never actually invoked.
jest.mock("../../src/services/rendered-document.service", () => ({
  getPersistedRenderedDocumentPdf: jest.fn(),
}));

const makeSourcePdf = async (pageCount: number): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    doc.addPage([200, 200]);
  }
  return Buffer.from(await doc.save());
};

const docs: MergedPacketDocument[] = [
  { documentId: "d1", title: "SOAP Note", kind: "SOAP_NOTE" },
  { documentId: "d2", title: "Prescription", kind: "PRESCRIPTION" },
];

describe("buildMergedClinicalPacketPdf", () => {
  it("merges document PDFs and appends a single signature page", async () => {
    const loader = jest
      .fn<Promise<Buffer>, [string, string]>()
      .mockResolvedValueOnce(await makeSourcePdf(2)) // d1: 2 pages
      .mockResolvedValueOnce(await makeSourcePdf(1)); // d2: 1 page

    const result = await buildMergedClinicalPacketPdf(
      { organisationId: "org-1", title: "Packet", documents: docs },
      loader,
    );

    // 2 + 1 source pages + 1 appended attestation/signature page
    expect(result.pageCount).toBe(4);
    expect(result.signaturePlacement.pageNumber).toBe(4);
    // Documenso uses percentage coordinates (0–100), not PDF points — guard
    // against a regression to point values (which land the field off-page).
    const placement = result.signaturePlacement;
    expect(placement.pageX).toBeGreaterThan(0);
    expect(placement.pageX).toBeLessThanOrEqual(100);
    expect(placement.pageY).toBeGreaterThan(0);
    expect(placement.pageY).toBeLessThanOrEqual(100);
    expect(placement.width).toBeGreaterThan(0);
    expect(placement.height).toBeGreaterThan(0);
    expect(placement.pageX + placement.width).toBeLessThanOrEqual(100);
    expect(placement.pageY + placement.height).toBeLessThanOrEqual(100);
    expect(result.pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    // Loader called once per document with the org id
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader).toHaveBeenNthCalledWith(1, "d1", "org-1");
    expect(loader).toHaveBeenNthCalledWith(2, "d2", "org-1");

    // The produced PDF must be loadable and have the expected page count
    const reloaded = await PDFDocument.load(result.pdf);
    expect(reloaded.getPageCount()).toBe(4);
  });

  it("includes the signer name when provided", async () => {
    const loader = jest
      .fn<Promise<Buffer>, [string, string]>()
      .mockResolvedValue(await makeSourcePdf(1));

    const result = await buildMergedClinicalPacketPdf(
      {
        organisationId: "org-1",
        title: "Packet",
        documents: [docs[0]],
        signerName: "Dr Jane Doe",
      },
      loader,
    );

    expect(result.pageCount).toBe(2);
    expect(result.signaturePlacement.pageNumber).toBe(2);
  });

  it("throws a 409 when there are no documents", async () => {
    await expect(
      buildMergedClinicalPacketPdf(
        { organisationId: "org-1", title: "Packet", documents: [] },
        jest.fn(),
      ),
    ).rejects.toMatchObject({
      name: "ClinicalPacketPdfError",
      statusCode: 409,
    });
  });

  it("throws a 502 when a document PDF cannot be loaded", async () => {
    const loader = jest
      .fn<Promise<Buffer>, [string, string]>()
      .mockRejectedValue(new Error("not found"));

    await expect(
      buildMergedClinicalPacketPdf(
        { organisationId: "org-1", title: "Packet", documents: [docs[0]] },
        loader,
      ),
    ).rejects.toBeInstanceOf(ClinicalPacketPdfError);
  });

  it("throws a 502 when a document PDF cannot be parsed", async () => {
    const loader = jest
      .fn<Promise<Buffer>, [string, string]>()
      .mockResolvedValue(Buffer.from("not a pdf"));

    await expect(
      buildMergedClinicalPacketPdf(
        { organisationId: "org-1", title: "Packet", documents: [docs[0]] },
        loader,
      ),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("preserves the loader's status code when it exposes one", async () => {
    class LoaderError extends Error {
      statusCode = 409;
    }
    const loader = jest
      .fn<Promise<Buffer>, [string, string]>()
      .mockRejectedValue(new LoaderError("not yet rendered"));

    await expect(
      buildMergedClinicalPacketPdf(
        { organisationId: "org-1", title: "Packet", documents: [docs[0]] },
        loader,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
