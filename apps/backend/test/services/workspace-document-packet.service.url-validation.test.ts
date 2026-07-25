import axios from "axios";
import dns from "node:dns";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { DocumensoService } from "../../src/services/documenso.service";
import { WorkspaceDocumentPacketService } from "../../src/services/workspace-document-packet.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    workspaceDocumentPacket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    encounter: { findFirst: jest.fn() },
    renderedDocument: { update: jest.fn() },
    documentSignature: { upsert: jest.fn() },
  },
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getEncounterBootstrap: jest.fn(),
  },
  WorkspaceServiceError: class WorkspaceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
      this.name = "WorkspaceServiceError";
    }
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    downloadSignedDocument: jest.fn(),
    getDocumentStatus: jest.fn(),
  },
}));

jest.mock("../../src/services/clinical-packet-pdf.service", () => ({
  buildMergedClinicalPacketPdf: jest.fn(),
}));

jest.mock("../../src/services/rendered-document-renderer.service", () => ({
  renderCombinedClinicalPacketPdf: jest.fn(),
}));

jest.mock("../../src/services/rendered-document.service", () => ({
  rerenderPersistedClinicalRenderedDocumentPdf: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/**
 * Covers the outbound-URL handling applied to the signing provider's signed
 * packet download link. The helper is module-private, so it is exercised
 * through `fetchSignedEncounterPacketPdf`, the exported path that consumes the
 * link.
 *
 * Two outcomes are deliberately different: a link the check turns down surfaces
 * as a typed 400, while a link that is merely unusable right now (expired,
 * unreachable) still returns `null` so the caller falls back to the live merge.
 *
 * Addresses from the 203.0.113.0/24 documentation range stand in for a public
 * host: they classify as public and need no name resolution.
 */
describe("workspace document packet signed-download URL validation", () => {
  const mockedPrisma = prisma as unknown as {
    workspaceDocumentPacket: { findFirst: jest.Mock };
  };
  const mockedDocumenso = DocumensoService as unknown as {
    resolveOrganisationApiKey: jest.Mock;
    downloadSignedDocument: jest.Mock;
  };
  const mockedAxios = axios as unknown as { get: jest.Mock };
  const mockedLogger = logger as unknown as { error: jest.Mock };
  const originalAllowedHosts =
    process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS;
  let lookupSpy: jest.SpyInstance;

  const NON_PUBLIC_HOST_MESSAGE =
    "Document URL host did not resolve to a permitted address";

  /** Bytes that open with the PDF marker, as any real document does. */
  const pdfBytes = (marker: string): Buffer =>
    Buffer.from(`%PDF-1.7\n${marker}\n%%EOF\n`);

  const expectedRequestOptions = expect.objectContaining({
    responseType: "arraybuffer",
    timeout: expect.any(Number),
    maxRedirects: 0,
    maxContentLength: expect.any(Number),
    maxBodyLength: expect.any(Number),
  });

  const arrangeSignedPacket = (downloadUrl: string): void => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "pkt-1",
      organisationId: "org-1",
      appointmentId: null,
      encounterId: "enc-1",
      companionId: null,
      status: "FINAL",
      documents: [],
      signing: {
        status: "SIGNED",
        documentId: "123",
        pdf: { url: downloadUrl },
      },
      signedBy: "user-1",
      signedByName: "Dr Vet",
      signedAt: new Date("2026-01-02"),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    });
    mockedDocumenso.resolveOrganisationApiKey.mockResolvedValue("api-key");
    mockedDocumenso.downloadSignedDocument.mockResolvedValue({ downloadUrl });
  };

  const fetchSignedPacket = (downloadUrl: string): Promise<Buffer | null> => {
    arrangeSignedPacket(downloadUrl);
    return WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
      "org-1",
      "enc-1",
    );
  };

  const resolvesTo = (...addresses: string[]): void => {
    lookupSpy.mockResolvedValue(
      addresses.map((address) => ({ address, family: 4 })),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS;
    lookupSpy = jest
      .spyOn(dns.promises, "lookup")
      .mockRejectedValue(new Error("ENOTFOUND"));
    mockedAxios.get.mockResolvedValue({
      data: pdfBytes("signed"),
      headers: { "content-type": "application/pdf" },
    });
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
    it("passes an https download URL through to axios with bounded request options", async () => {
      const pdf = await fetchSignedPacket(
        "https://203.0.113.10/packets/pkt-1.pdf?sig=abc",
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://203.0.113.10/packets/pkt-1.pdf?sig=abc",
        expectedRequestOptions,
      );
      expect(pdf).toEqual(pdfBytes("signed"));
    });

    it("passes a plain http download URL through to axios", async () => {
      await fetchSignedPacket("http://203.0.113.10/packets/pkt-1.pdf");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "http://203.0.113.10/packets/pkt-1.pdf",
        expectedRequestOptions,
      );
    });

    it("normalises a bare origin to its href form", async () => {
      await fetchSignedPacket("https://203.0.113.10");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://203.0.113.10/",
        expectedRequestOptions,
      );
    });

    it("fetches a name that resolves to a public address and pins the connection", async () => {
      resolvesTo("203.0.113.10");

      await fetchSignedPacket("https://signed.example/packets/pkt-1.pdf");

      expect(lookupSpy).toHaveBeenCalledWith("signed.example", { all: true });
      const [, options] = mockedAxios.get.mock.calls[0] as [
        string,
        { httpAgent?: unknown; httpsAgent?: unknown },
      ];
      expect(options.httpAgent).toBeDefined();
      expect(options.httpsAgent).toBe(options.httpAgent);
    });
  });

  describe("rejected schemes", () => {
    it.each([
      ["file", "file:///var/lib/documents/invoice-1.pdf"],
      ["data", "data:application/pdf;base64,JVBERi0xLjQK"],
      ["ftp", "ftp://files.internal/packets/pkt-1.pdf"],
      ["javascript", "javascript:alert(1)"],
      ["gopher", "gopher://files.internal:70/1"],
    ])("rejects the %s scheme", async (_scheme, url) => {
      await expect(fetchSignedPacket(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("rejected paths", () => {
    it("rejects a literal dot-segment path", async () => {
      await expect(
        fetchSignedPacket("https://203.0.113.10/packets/../../secret.pdf"),
      ).rejects.toThrow("Invalid URL");
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it.each([
      ["lowercase", "https://203.0.113.10/packets/%2e%2e/secret.pdf"],
      ["uppercase", "https://203.0.113.10/packets/%2E%2E/secret.pdf"],
    ])("rejects a %s percent-encoded dot-segment path", async (_case, url) => {
      await expect(fetchSignedPacket(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("malformed input", () => {
    it.each([
      ["a non-URL string", "not a url at all"],
      ["a scheme-relative path", "//203.0.113.10/pkt-1.pdf"],
      ["a root-relative path", "/packets/pkt-1.pdf"],
    ])("rejects %s", async (_case, url) => {
      await expect(fetchSignedPacket(url)).rejects.toThrow("Invalid URL");
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("hosts that do not resolve to a public address", () => {
    it.each([
      ["loopback by address", "http://127.0.0.1/packets/pkt-1.pdf"],
      ["a 10.0.0.0/8 address", "http://10.0.0.5/packets/pkt-1.pdf"],
      ["a 192.168.0.0/16 address", "http://192.168.1.10/packets/pkt-1.pdf"],
      ["a 172.16.0.0/12 address", "http://172.16.4.4/packets/pkt-1.pdf"],
      ["a link-local address", "http://169.254.1.1/packets/pkt-1.pdf"],
      ["an IPv6 loopback literal", "http://[::1]/packets/pkt-1.pdf"],
      ["an IPv6 unique-local literal", "http://[fd00::1]/packets/pkt-1.pdf"],
    ])("rejects %s", async (_case, url) => {
      await expect(fetchSignedPacket(url)).rejects.toThrow(
        NON_PUBLIC_HOST_MESSAGE,
      );
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("rejects a name that resolves to a non-public address", async () => {
      resolvesTo("10.0.0.5");

      await expect(
        fetchSignedPacket("https://signed.example/packets/pkt-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("rejects a name whose answers mix public and non-public addresses", async () => {
      resolvesTo("203.0.113.10", "127.0.0.1");

      await expect(
        fetchSignedPacket("https://signed.example/packets/pkt-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("rejects a name that does not resolve at all", async () => {
      await expect(
        fetchSignedPacket("https://signed.example/packets/pkt-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("configured internal hosts", () => {
    it("fetches a host the deployment has opted in", async () => {
      process.env.DOCUMENT_FETCH_ALLOWED_INTERNAL_HOSTS = "storage.internal";

      const pdf = await fetchSignedPacket(
        "http://storage.internal:9000/packets/pkt-1.pdf",
      );

      expect(pdf).toEqual(pdfBytes("signed"));
      expect(mockedAxios.get).toHaveBeenCalledWith(
        "http://storage.internal:9000/packets/pkt-1.pdf",
        expectedRequestOptions,
      );
      expect(lookupSpy).not.toHaveBeenCalled();
    });

    it("opts nothing in by default", async () => {
      await expect(
        fetchSignedPacket("http://storage.internal/packets/pkt-1.pdf"),
      ).rejects.toThrow(NON_PUBLIC_HOST_MESSAGE);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });

  describe("response content", () => {
    const fetchReturning = (
      data: unknown,
      headers?: Record<string, string>,
    ): Promise<Buffer | null> => {
      mockedAxios.get.mockReset();
      mockedAxios.get.mockResolvedValue({ data, headers });
      return fetchSignedPacket("https://203.0.113.10/packets/pkt-1.pdf");
    };

    it("returns a response declared as a PDF", async () => {
      const pdf = await fetchReturning(pdfBytes("signed"), {
        "content-type": "application/pdf",
      });

      expect(pdf).toEqual(pdfBytes("signed"));
    });

    it.each([
      ["no content type at all", undefined],
      ["a generic binary content type", "application/octet-stream"],
      ["the alternate generic binary content type", "binary/octet-stream"],
    ])(
      "returns correct leading bytes served with %s",
      async (_case, contentType) => {
        const pdf = await fetchReturning(
          pdfBytes("signed"),
          contentType ? { "content-type": contentType } : undefined,
        );

        expect(pdf).toEqual(pdfBytes("signed"));
      },
    );

    it.each([
      ["html", "text/html"],
      ["json", "application/json"],
    ])(
      "falls back to null for a response declared as %s",
      async (_case, contentType) => {
        const pdf = await fetchReturning(pdfBytes("signed"), {
          "content-type": contentType,
        });

        expect(pdf).toBeNull();
        expect(mockedLogger.error).toHaveBeenCalled();
      },
    );

    it("falls back to null when the body does not start with the marker", async () => {
      const pdf = await fetchReturning(
        Buffer.from("<html>not a document</html>"),
        { "content-type": "application/pdf" },
      );

      expect(pdf).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });

    it.each([
      ["an empty body", Buffer.alloc(0)],
      ["a body shorter than the marker", Buffer.from("%PD")],
    ])("falls back to null for %s", async (_case, body) => {
      const pdf = await fetchReturning(body, {
        "content-type": "application/pdf",
      });

      expect(pdf).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("telling a turned-down link apart from an unusable one", () => {
    it.each([
      ["a rejected scheme", "ftp://files.internal/pkt-1.pdf"],
      ["a host without a permitted address", "http://127.0.0.1/pkt-1.pdf"],
    ])("surfaces %s as a typed 400", async (_case, url) => {
      const error = await fetchSignedPacket(url).catch(
        (caught: unknown) => caught,
      );

      expect(error).toMatchObject({
        name: "WorkspaceServiceError",
        statusCode: 400,
      });
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("falls back to null when the permitted download itself fails", async () => {
      mockedAxios.get.mockRejectedValue(new Error("socket hang up"));

      const pdf = await fetchSignedPacket(
        "https://203.0.113.10/packets/pkt-1.pdf",
      );

      expect(pdf).toBeNull();
      expect(mockedLogger.error).toHaveBeenCalled();
    });

    it("falls back to null when the signing provider cannot hand back a link", async () => {
      arrangeSignedPacket("https://203.0.113.10/packets/pkt-1.pdf");
      mockedDocumenso.downloadSignedDocument.mockRejectedValue(
        new Error("provider unavailable"),
      );

      const pdf =
        await WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
          "org-1",
          "enc-1",
        );

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockedLogger.error).toHaveBeenCalled();
    });

    it("falls back to null when the encounter has no signed packet", async () => {
      mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(null);

      const pdf =
        await WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
          "org-1",
          "enc-1",
        );

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("falls back to null when the packet's signing never completed", async () => {
      arrangeSignedPacket("https://203.0.113.10/packets/pkt-1.pdf");
      mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
        id: "pkt-1",
        organisationId: "org-1",
        appointmentId: null,
        encounterId: "enc-1",
        companionId: null,
        status: "FINAL",
        documents: [],
        signing: { status: "IN_PROGRESS", documentId: "123" },
        signedBy: null,
        signedByName: null,
        signedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      });

      const pdf =
        await WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
          "org-1",
          "enc-1",
        );

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("falls back to null when there is no link at all", async () => {
      arrangeSignedPacket("https://203.0.113.10/packets/pkt-1.pdf");
      mockedDocumenso.downloadSignedDocument.mockResolvedValue({
        downloadUrl: null,
      });
      mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
        id: "pkt-1",
        organisationId: "org-1",
        appointmentId: null,
        encounterId: "enc-1",
        companionId: null,
        status: "FINAL",
        documents: [],
        signing: { status: "SIGNED", documentId: "123" },
        signedBy: "user-1",
        signedByName: "Dr Vet",
        signedAt: new Date("2026-01-02"),
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      });

      const pdf =
        await WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
          "org-1",
          "enc-1",
        );

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });
});
