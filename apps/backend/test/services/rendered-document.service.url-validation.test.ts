import axios from "axios";
import dns from "node:dns";
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
 * Covers the outbound-URL handling `downloadPdfBuffer` applies before fetching a
 * rendered document's stored PDF. The helper is module-private, so it is
 * exercised through `getPersistedRenderedDocumentPdf`, the exported read path
 * that reaches it.
 *
 * Addresses from the 203.0.113.0/24 documentation range stand in for a public
 * host: they classify as public and need no name resolution.
 */
describe("rendered-document service outbound PDF URL validation", () => {
  const mockedPrisma = prisma as unknown as {
    renderedDocument: { findUnique: jest.Mock };
  };
  const mockedAxiosGet = axios.get as jest.Mock;
  const originalBucket = process.env.AWS_S3_BUCKET_NAME;
  const originalAllowedHosts =
    process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS;
  let lookupSpy: jest.SpyInstance;

  const arrangeDocument = (pdfUrl: string): void => {
    mockedPrisma.renderedDocument.findUnique.mockResolvedValueOnce({
      id: "doc-1",
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
    return getPersistedRenderedDocumentPdf("doc-1", "org-123");
  };

  const expectedRequestOptions = expect.objectContaining({
    responseType: "arraybuffer",
    timeout: expect.any(Number),
    maxRedirects: 0,
    maxContentLength: expect.any(Number),
    maxBodyLength: expect.any(Number),
  });

  const NON_PUBLIC_HOST_MESSAGE =
    "Document URL host did not resolve to a permitted address";

  const resolvesTo = (...addresses: string[]): void => {
    lookupSpy.mockResolvedValue(
      addresses.map((address) => ({ address, family: 4 })),
    );
  };

  beforeAll(() => {
    // Exercise the real bucket-first branch so the guarded axios fallback is
    // the path under test, rather than being reached via a missing bucket name.
    process.env.AWS_S3_BUCKET_NAME = "test-bucket";
  });

  afterAll(() => {
    if (originalBucket === undefined) {
      delete process.env.AWS_S3_BUCKET_NAME;
    } else {
      process.env.AWS_S3_BUCKET_NAME = originalBucket;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS;
    // Names resolve through `dns.promises.lookup`; every test states what a name
    // maps to, so none of them depends on real resolution.
    lookupSpy = jest
      .spyOn(dns.promises, "lookup")
      .mockRejectedValue(new Error("ENOTFOUND"));
    // The stored URL is not an object in our bucket, so the bucket read misses
    // and the service falls through to the validated direct fetch.
    mockS3GetObject.mockRejectedValue(new Error("NoSuchKey"));
    mockedAxiosGet.mockResolvedValue({ data: Buffer.from("pdf-bytes") });
  });

  afterEach(() => {
    lookupSpy.mockRestore();
    if (originalAllowedHosts === undefined) {
      delete process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS;
    } else {
      process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS = originalAllowedHosts;
    }
  });

  describe("permitted URLs", () => {
    it("passes an https URL through to axios with bounded request options", async () => {
      const result = (await fetchPdf(
        "https://203.0.113.10/rendered/invoice-1.pdf",
      )) as { pdf: Buffer; contentType: string };

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://203.0.113.10/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
      expect(result.pdf).toEqual(Buffer.from("pdf-bytes"));
      expect(result.contentType).toBe("application/pdf");
    });

    it("passes a plain http URL through to axios", async () => {
      await fetchPdf("http://203.0.113.10/rendered/invoice-1.pdf");

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "http://203.0.113.10/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
    });

    it("preserves the query string and normalises a bare origin", async () => {
      await fetchPdf("https://203.0.113.10?token=abc");

      // `url.href` is what the helper returns, so the origin gains a trailing
      // slash while the query survives intact.
      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://203.0.113.10/?token=abc",
        expectedRequestOptions,
      );
    });

    it("fetches a name that resolves to a public address", async () => {
      resolvesTo("203.0.113.10");

      await fetchPdf("https://cdn.example/rendered/invoice-1.pdf");

      expect(lookupSpy).toHaveBeenCalledWith("cdn.example", { all: true });
      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://cdn.example/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
    });

    it("pins the connection to the addresses it checked", async () => {
      resolvesTo("203.0.113.10");

      await fetchPdf("https://cdn.example/rendered/invoice-1.pdf");

      const [, options] = mockedAxiosGet.mock.calls[0] as [
        string,
        { httpAgent?: unknown; httpsAgent?: unknown },
      ];
      expect(options.httpAgent).toBeDefined();
      expect(options.httpsAgent).toBe(options.httpAgent);
    });

    it("returns the stored object directly without an outbound request", async () => {
      mockS3GetObject.mockReset();
      mockS3GetObject.mockResolvedValue({ Body: Buffer.from("stored-bytes") });

      const result = (await fetchPdf(
        "https://203.0.113.10/rendered/invoice-1.pdf",
      )) as { pdf: Buffer };

      expect(result.pdf).toEqual(Buffer.from("stored-bytes"));
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("derives the object key from the normalised URL", async () => {
      mockS3GetObject.mockReset();
      mockS3GetObject.mockResolvedValue({ Body: Buffer.from("stored-bytes") });

      await fetchPdf("https://203.0.113.10/rendered/invoice%201.pdf");

      expect(mockS3GetObject).toHaveBeenCalledWith({
        Bucket: "test-bucket",
        Key: "rendered/invoice 1.pdf",
      });
    });

    it.each([
      ["a byte array", new Uint8Array([1, 2, 3]), Buffer.from([1, 2, 3])],
      ["a string", "stored-bytes", Buffer.from("stored-bytes")],
    ])("returns a stored body given as %s", async (_case, body, expected) => {
      mockS3GetObject.mockReset();
      mockS3GetObject.mockResolvedValue({ Body: body });

      const result = (await fetchPdf(
        "https://203.0.113.10/rendered/invoice-1.pdf",
      )) as { pdf: Buffer };

      expect(result.pdf).toEqual(expected);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("falls back to the direct fetch when the stored object has no body", async () => {
      mockS3GetObject.mockReset();
      mockS3GetObject.mockResolvedValue({ Body: undefined });

      await fetchPdf("https://203.0.113.10/rendered/invoice-1.pdf");

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://203.0.113.10/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
    });

    it("falls back to the direct fetch when the URL carries no object key", async () => {
      mockS3GetObject.mockReset();

      await fetchPdf("https://203.0.113.10/");

      expect(mockS3GetObject).not.toHaveBeenCalled();
      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "https://203.0.113.10/",
        expectedRequestOptions,
      );
    });
  });

  describe("rejected schemes", () => {
    it.each([
      ["file", "file:///var/lib/documents/invoice-1.pdf"],
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
        fetchPdf("https://203.0.113.10/rendered/../../secret.pdf"),
      ).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it.each([
      ["lowercase", "https://203.0.113.10/rendered/%2e%2e/secret.pdf"],
      ["uppercase", "https://203.0.113.10/rendered/%2E%2E/secret.pdf"],
    ])("rejects a %s percent-encoded dot-segment", async (_case, url) => {
      await expect(fetchPdf(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("malformed input", () => {
    // An empty `pdfUrl` never reaches the check: the caller treats it as
    // "no stored PDF" and re-renders instead, so only non-empty garbage is
    // relevant here.
    it.each([
      ["a non-URL string", "not a url at all"],
      ["a scheme-relative path", "//203.0.113.10/invoice.pdf"],
      ["a root-relative path", "/rendered/invoice-1.pdf"],
    ])("rejects %s", async (_case, url) => {
      await expect(fetchPdf(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("hosts that do not resolve to a public address", () => {
    it.each([
      ["loopback by address", "http://127.0.0.1/rendered/invoice-1.pdf"],
      ["a 10.0.0.0/8 address", "http://10.0.0.5/rendered/invoice-1.pdf"],
      [
        "a 192.168.0.0/16 address",
        "http://192.168.1.10/rendered/invoice-1.pdf",
      ],
      ["a 172.16.0.0/12 address", "http://172.16.4.4/rendered/invoice-1.pdf"],
      ["a link-local address", "http://169.254.1.1/rendered/invoice-1.pdf"],
      ["an IPv6 loopback literal", "http://[::1]/rendered/invoice-1.pdf"],
      [
        "an IPv6 unique-local literal",
        "http://[fd00::1]/rendered/invoice-1.pdf",
      ],
    ])("rejects %s", async (_case, url) => {
      await expect(fetchPdf(url)).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("rejects a name that resolves to a non-public address", async () => {
      resolvesTo("10.0.0.5");

      await expect(
        fetchPdf("https://cdn.example/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("rejects a name whose answers mix public and non-public addresses", async () => {
      resolvesTo("203.0.113.10", "127.0.0.1");

      await expect(
        fetchPdf("https://cdn.example/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("rejects a name that does not resolve at all", async () => {
      await expect(
        fetchPdf("https://cdn.example/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("does not read the bucket for a URL it turns down", async () => {
      await expect(
        fetchPdf("http://127.0.0.1/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockS3GetObject).not.toHaveBeenCalled();
    });
  });

  describe("configured internal hosts", () => {
    it("fetches a host the deployment has opted in", async () => {
      process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS = "storage.internal";

      await fetchPdf("http://storage.internal:9000/rendered/invoice-1.pdf");

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "http://storage.internal:9000/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
      expect(lookupSpy).not.toHaveBeenCalled();
    });

    it("matches an opted-in host regardless of case and surrounding spaces", async () => {
      process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS =
        " other.internal , Storage.Internal ";

      await fetchPdf("http://STORAGE.internal/rendered/invoice-1.pdf");

      expect(mockedAxiosGet).toHaveBeenCalledWith(
        "http://storage.internal/rendered/invoice-1.pdf",
        expectedRequestOptions,
      );
    });

    it("still rejects a host that is not on the configured list", async () => {
      process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS = "storage.internal";

      await expect(
        fetchPdf("http://10.0.0.5/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });

    it("opts nothing in by default", async () => {
      await expect(
        fetchPdf("http://storage.internal/rendered/invoice-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxiosGet).not.toHaveBeenCalled();
    });
  });

  describe("error shape", () => {
    it.each([
      ["a rejected scheme", "ftp://files.internal/rendered/invoice-1.pdf"],
      ["a host without a permitted address", "http://127.0.0.1/invoice-1.pdf"],
    ])(
      "surfaces %s as a rendered-document service error with a 400 status",
      async (_case, url) => {
        arrangeDocument(url);

        const error = await getPersistedRenderedDocumentPdf(
          "doc-1",
          "org-123",
        ).catch((caught: unknown) => caught);

        expect(error).toMatchObject({
          name: "RenderedDocumentServiceError",
          statusCode: 400,
        });
      },
    );
  });
});
