import axios from "axios";
import { prisma } from "src/config/prisma";
import { getPersistedRenderedDocumentPdf } from "../../src/services/rendered-document.service";

const mockS3GetObject = jest.fn();

jest.mock("aws-sdk", () => ({
  S3: jest.fn().mockImplementation(() => ({
    getObject: (params: unknown) => ({
      promise: () => mockS3GetObject(params),
    }),
  })),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    renderedDocument: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    documentSignature: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/rendered-document-renderer.service", () => ({
  renderRenderedDocumentPdfWithMetadata: jest.fn(),
}));

jest.mock("../../src/middlewares/upload", () => ({
  uploadBufferAsFile: jest.fn(),
}));

jest.mock("axios", () => ({
  get: jest.fn(),
}));

/**
 * Covers the outbound-URL guard `downloadPdfBuffer` applies before fetching a
 * rendered document's stored PDF. The guard itself is module-private, so it is
 * exercised through `getPersistedRenderedDocumentPdf`, the exported read path
 * that reaches it.
 */
describe("rendered-document service outbound PDF URL validation", () => {
  const mockedPrisma = prisma as unknown as {
    renderedDocument: { findUnique: jest.Mock };
  };
  const mockedAxiosGet = axios.get as jest.Mock;
  const originalBucket = process.env.AWS_S3_BUCKET_NAME;

  const arrangeDocument = (pdfUrl: string): void => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-ssrf",
      organisationId: "org-123",
      sourceKind: "INVOICE",
      sourceId: "invoice-1",
      templateInstanceId: null,
      clinicalArtifactId: null,
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      kind: "INVOICE",
      version: 1,
      title: "Invoice",
      mimeType: "application/pdf",
      status: "DRAFT",
      signable: false,
      pdfUrl,
      pdf: null,
      signedBy: null,
      signedAt: null,
      createdAt: new Date("2026-06-13T00:00:00.000Z"),
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      signature: null,
    });
  };

  const fetchPdf = (pdfUrl: string): Promise<unknown> => {
    arrangeDocument(pdfUrl);
    return getPersistedRenderedDocumentPdf("doc-ssrf", "org-123");
  };

  beforeAll(() => {
    // Exercise the real S3-first branch so the guarded axios fallback is the
    // path under test, rather than being reached via a missing bucket name.
    process.env.AWS_S3_BUCKET_NAME = "test-bucket";
  });

  afterAll(() => {
    if (originalBucket === undefined) {
      delete process.env.AWS_S3_BUCKET_NAME;
      return;
    }
    process.env.AWS_S3_BUCKET_NAME = originalBucket;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // The stored URL is not an object in our bucket, so the S3 read misses and
    // the service falls through to the validated direct fetch.
    mockS3GetObject.mockRejectedValue(new Error("NoSuchKey"));
    mockedAxiosGet.mockResolvedValue({ data: Buffer.from("pdf-bytes") });
  });

  describe("permitted URLs", () => {
    it("passes an https URL through to axios unchanged", async () => {
      const result = (await fetchPdf(
        "https://cdn.example/rendered/invoice-1.pdf",
      )) as { pdf: Buffer; contentType: string };

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://cdn.example/rendered/invoice-1.pdf",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
      expect(result.pdf).toEqual(Buffer.from("pdf-bytes"));
      expect(result.contentType).toBe("application/pdf");
    });

    it("passes a plain http URL through to axios", async () => {
      await fetchPdf("http://cdn.example/rendered/invoice-1.pdf");

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "http://cdn.example/rendered/invoice-1.pdf",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });

    it("preserves the query string and normalises a bare origin", async () => {
      await fetchPdf("https://cdn.example?token=abc");

      // `url.href` is what the guard returns, so the origin gains a trailing
      // slash while the query survives intact.
      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://cdn.example/?token=abc",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });

    it("returns the S3 object directly without reaching the URL guard", async () => {
      mockS3GetObject.mockReset();
      mockS3GetObject.mockResolvedValue({ Body: Buffer.from("s3-bytes") });

      const result = (await fetchPdf(
        "https://cdn.example/rendered/invoice-1.pdf",
      )) as { pdf: Buffer };

      expect(result.pdf).toEqual(Buffer.from("s3-bytes"));
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("rejected schemes", () => {
    it.each([
      ["file", "file:///etc/passwd"],
      ["data", "data:application/pdf;base64,JVBERi0xLjQK"],
      ["ftp", "ftp://files.internal/rendered/invoice-1.pdf"],
      ["javascript", "javascript:alert(1)"],
      ["gopher", "gopher://files.internal:70/1"],
    ])("rejects the %s scheme", async (_scheme, url) => {
      await expect(fetchPdf(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("rejected paths", () => {
    it("rejects a literal dot-segment before URL parsing collapses it", async () => {
      await expect(
        fetchPdf("https://cdn.example/rendered/../../secret.pdf"),
      ).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it.each([
      ["lowercase", "https://cdn.example/rendered/%2e%2e/secret.pdf"],
      ["uppercase", "https://cdn.example/rendered/%2E%2E/secret.pdf"],
    ])("rejects a %s percent-encoded dot-segment", async (_case, url) => {
      await expect(fetchPdf(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("malformed input", () => {
    // An empty `pdfUrl` never reaches the guard: the caller treats it as
    // "no stored PDF" and re-renders instead, so only non-empty garbage is
    // relevant here.
    it.each([
      ["a non-URL string", "not a url at all"],
      ["a scheme-relative path", "//cdn.example/invoice.pdf"],
      ["a root-relative path", "/rendered/invoice-1.pdf"],
    ])("rejects %s", async (_case, url) => {
      await expect(fetchPdf(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("collapses every rejection reason into a plain Error, not a service error", async () => {
      arrangeDocument("ftp://files.internal/rendered/invoice-1.pdf");

      const error = await getPersistedRenderedDocumentPdf(
        "doc-ssrf",
        "org-123",
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Invalid URL");
      expect((error as Error).name).toBe("Error");
    });
  });

  describe("KNOWN GAP: the guard checks scheme and path only", () => {
    // The guard performs no address classification, so internal targets still
    // pass. `packages/lib/src/pdf/resolveLogoSource.ts` already ships the
    // hardened version of this check (DNS resolution, private/loopback/
    // link-local rejection, redirect and size limits, DNS-rebinding pinning);
    // these cases record the untreated behaviour on this code path so a future
    // hardening change surfaces here.
    it.each([
      ["loopback by IP", "http://127.0.0.1/rendered/invoice-1.pdf"],
      ["loopback by name", "http://localhost:9000/rendered/invoice-1.pdf"],
      ["RFC1918 10.x", "http://10.0.0.5/rendered/invoice-1.pdf"],
      ["RFC1918 192.168.x", "http://192.168.1.10/rendered/invoice-1.pdf"],
      [
        "cloud instance metadata",
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      ],
    ])("still fetches %s", async (_case, url) => {
      await fetchPdf(url);

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });
  });
});
