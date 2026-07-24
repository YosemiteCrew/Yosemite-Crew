import axios from "axios";
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
 * Covers the outbound-URL guard applied to the Documenso-issued signed packet
 * download link. The guard is module-private, so it is exercised through
 * `fetchSignedEncounterPacketPdf`, the exported path that consumes the link.
 * A rejected URL is swallowed by that method's catch, so the observable
 * outcome is `null` plus no outbound request.
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({ data: Buffer.from("signed-pdf") });
  });

  describe("permitted URLs", () => {
    it("passes an https download URL through to axios unchanged", async () => {
      const pdf = await fetchSignedPacket(
        "https://signed.example/packets/pkt-1.pdf?sig=abc",
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://signed.example/packets/pkt-1.pdf?sig=abc",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
      expect(pdf?.toString()).toBe("signed-pdf");
    });

    it("passes a plain http download URL through to axios", async () => {
      await fetchSignedPacket("http://signed.example/packets/pkt-1.pdf");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "http://signed.example/packets/pkt-1.pdf",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });

    it("normalises a bare origin to its href form", async () => {
      await fetchSignedPacket("https://signed.example");

      expect(mockedAxios.get).toHaveBeenCalledWith(
        "https://signed.example/",
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });
  });

  describe("rejected schemes", () => {
    it.each([
      ["file", "file:///etc/passwd"],
      ["data", "data:application/pdf;base64,JVBERi0xLjQK"],
      ["ftp", "ftp://files.internal/packets/pkt-1.pdf"],
      ["javascript", "javascript:alert(1)"],
      ["gopher", "gopher://files.internal:70/1"],
    ])("does not fetch over the %s scheme", async (_scheme, url) => {
      const pdf = await fetchSignedPacket(url);

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(mockedLogger.error).toHaveBeenCalled();
    });
  });

  describe("rejected paths", () => {
    it("does not fetch a literal dot-segment path", async () => {
      const pdf = await fetchSignedPacket(
        "https://signed.example/packets/../../secret.pdf",
      );

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it.each([
      ["lowercase", "https://signed.example/packets/%2e%2e/secret.pdf"],
      ["uppercase", "https://signed.example/packets/%2E%2E/secret.pdf"],
    ])(
      "does not fetch a %s percent-encoded dot-segment path",
      async (_case, url) => {
        const pdf = await fetchSignedPacket(url);

        expect(pdf).toBeNull();
        expect(mockedAxios.get).not.toHaveBeenCalled();
      },
    );
  });

  describe("malformed input", () => {
    it.each([
      ["a non-URL string", "not a url at all"],
      ["a scheme-relative path", "//signed.example/pkt-1.pdf"],
      ["a root-relative path", "/packets/pkt-1.pdf"],
    ])("does not fetch %s", async (_case, url) => {
      const pdf = await fetchSignedPacket(url);

      expect(pdf).toBeNull();
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("logs the rejection rather than surfacing it to the caller", async () => {
      const pdf = await fetchSignedPacket("ftp://files.internal/pkt-1.pdf");

      expect(pdf).toBeNull();
      const [, loggedError] = mockedLogger.error.mock.calls[0] as [
        string,
        unknown,
      ];
      expect(loggedError).toBeInstanceOf(Error);
      expect((loggedError as Error).message).toBe("Invalid URL");
    });
  });

  describe("KNOWN GAP: the guard checks scheme and path only", () => {
    // No address classification is performed, so an attacker-influenced
    // Documenso download URL pointing at an internal target is still fetched.
    // `packages/lib/src/pdf/resolveLogoSource.ts` holds the hardened form of
    // this check; these cases record the untreated behaviour here.
    it.each([
      ["loopback by IP", "http://127.0.0.1/packets/pkt-1.pdf"],
      ["loopback by name", "http://localhost:9000/packets/pkt-1.pdf"],
      ["RFC1918 10.x", "http://10.0.0.5/packets/pkt-1.pdf"],
      ["RFC1918 192.168.x", "http://192.168.1.10/packets/pkt-1.pdf"],
      [
        "cloud instance metadata",
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
      ],
    ])("still fetches %s", async (_case, url) => {
      await fetchSignedPacket(url);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ responseType: "arraybuffer" }),
      );
    });
  });
});
