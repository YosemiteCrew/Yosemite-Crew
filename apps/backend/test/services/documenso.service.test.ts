/* eslint-disable @typescript-eslint/no-var-requires */
// test/services/documenso.service.test.ts
import axios from "axios";
import { prisma } from "src/config/prisma";
import logger from "../../src/utils/logger";
import { DocumensoError } from "@documenso/sdk-typescript/models/errors/index.js";

// --- MOCK SETUP ---
jest.mock("axios");

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockCreate = jest.fn();
const mockDistribute = jest.fn();
const mockGet = jest.fn();

jest.mock("@documenso/sdk-typescript", () => {
  return {
    Documenso: jest.fn().mockImplementation(() => ({
      documents: {
        create: mockCreate,
        distribute: mockDistribute,
        get: mockGet,
      },
    })),
  };
});

jest.mock("@documenso/sdk-typescript/models/errors/index.js", () => {
  class MockDocumensoError extends Error {
    statusCode: number;
    body: any;
    constructor(message: string, statusCode: number, body: any) {
      super(message);
      this.statusCode = statusCode;
      this.body = body;
    }
  }
  return { DocumensoError: MockDocumensoError, __esModule: true };
});

// --- HELPER TO TEST LOAD-TIME ENV VARIABLES ---
function getModule(envOverrides: Record<string, string>) {
  let mod: any;
  jest.isolateModules(() => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, ...envOverrides };
    mod = require("../../src/services/documenso.service");
    process.env = originalEnv;
  });
  return mod.DocumensoService;
}

// --- TESTS ---

describe("DocumensoService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Configuration & Environment Variable Errors", () => {
    it("throws if DOCUMENSO_BASE_URL is not set", async () => {
      const Service = getModule({
        DOCUMENSO_BASE_URL: "",
        DOCUMENSO_API_KEY: "dummy_key",
      });
      await Service.createDocument({
        pdf: Buffer.from(""),
        signerEmail: "a@a.com",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: "DOCUMENSO_BASE_URL is not set" }),
      );
    });

    it("throws if DOCUMENSO_BASE_URL is invalid", async () => {
      const Service = getModule({
        DOCUMENSO_BASE_URL: "invalid-url",
        DOCUMENSO_API_KEY: "dummy_key",
      });
      await Service.createDocument({
        pdf: Buffer.from(""),
        signerEmail: "a@a.com",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: "DOCUMENSO_BASE_URL is invalid" }),
      );
    });

    it("throws if DOCUMENSO_API_KEY is not set (no override provided)", async () => {
      const Service = getModule({
        DOCUMENSO_BASE_URL: "http://valid.com",
        DOCUMENSO_API_KEY: "",
      });
      await Service.createDocument({
        pdf: Buffer.from(""),
        signerEmail: "a@a.com",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: "DOCUMENSO_API_KEY is not set" }),
      );
    });

    it("throws in downloadSignedDocument if DOCUMENSO_API_KEY is missing", async () => {
      const Service = getModule({
        DOCUMENSO_BASE_URL: "http://valid.com",
        DOCUMENSO_API_KEY: "",
      });
      await Service.downloadSignedDocument({ documentId: 1 });
      expect(logger.error).toHaveBeenCalledWith(
        "An unexpected error occurred:",
        expect.objectContaining({ message: "DOCUMENSO_API_KEY is not set" }),
      );
    });

    it("throws if DOCUMENSO_HOST_URL is not set", async () => {
      const Service = getModule({
        DOCUMENSO_HOST_URL: "",
        DOCUMENSO_EXTERNAL_AUTH_SECRET: "sec",
      });
      await expect(
        Service.generateExternalRedirectUrl({} as any),
      ).rejects.toThrow("DOCUMENSO_URL or DOCUMENSO_BASE_URL is not set");
    });

    it("throws if DOCUMENSO_HOST_URL is invalid", async () => {
      const Service = getModule({
        DOCUMENSO_HOST_URL: "bad-url",
        DOCUMENSO_EXTERNAL_AUTH_SECRET: "sec",
      });
      await expect(
        Service.generateExternalRedirectUrl({} as any),
      ).rejects.toThrow("DOCUMENSO_URL is invalid");
    });

    it("throws if DOCUMENSO_EXTERNAL_AUTH_SECRET is not set", async () => {
      const Service = getModule({
        DOCUMENSO_HOST_URL: "http://valid.com",
        DOCUMENSO_EXTERNAL_AUTH_SECRET: "",
      });
      await expect(
        Service.generateExternalRedirectUrl({} as any),
      ).rejects.toThrow(
        "DOCUMENSO_EXTERNAL_AUTH_SECRET or EXTERNAL_AUTH_SECRET is not set",
      );
    });
  });

  describe("Service Methods (with valid config)", () => {
    let DocumensoService: any;

    beforeAll(() => {
      DocumensoService = getModule({
        DOCUMENSO_BASE_URL: "http://api.documenso.local",
        DOCUMENSO_API_KEY: "valid_api_key",
        DOCUMENSO_HOST_URL: "http://app.documenso.local",
        DOCUMENSO_EXTERNAL_AUTH_SECRET: "super_secret",
      });
      jest.spyOn(console, "log").mockImplementation(() => {});
    });

    describe("createDocument", () => {
      it("creates a document successfully and falls back to signerEmail for name", async () => {
        mockCreate.mockResolvedValueOnce({ id: 1, envelopeId: "env_1" });
        mockGet.mockResolvedValueOnce({
          id: 1,
          recipients: [{ id: 11, token: "synthetic-recipient-token" }],
        });
        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        expect(result.recipients[0].token).toBe("synthetic-recipient-token");
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              recipients: expect.arrayContaining([
                expect.objectContaining({ name: "test@test.com" }),
              ]),
            }),
            file: {
              fileName: "document.pdf",
              content: expect.any(Uint8Array),
            },
          }),
        );
        expect(mockGet).toHaveBeenCalledWith({ documentId: 1 });
      });

      it("uses provided signerName and caches Documenso Client", async () => {
        mockCreate.mockResolvedValue({ id: 2, envelopeId: "env_2" });
        mockGet.mockResolvedValue({ id: 2, recipients: [] });

        // 1st Call - Misses cache, sets cache
        await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          signerName: "John Doe",
          apiKey: "cache_key_1",
        });

        // 2nd Call - Hits cache branch: `if (cached) return cached;`
        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          signerName: "John Doe",
          apiKey: "cache_key_1",
        });

        expect(result).toEqual({ id: 2, recipients: [] });
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              recipients: expect.arrayContaining([
                expect.objectContaining({ name: "John Doe" }),
              ]),
            }),
          }),
        );
      });

      it("sends the signature field on-page so the signer can reach it", async () => {
        mockCreate.mockResolvedValueOnce({ id: 3, envelopeId: "env_3" });
        mockGet.mockResolvedValueOnce({ id: 3, recipients: [] });

        await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          signaturePlacement: {
            pageNumber: 1,
            pageX: 59.66,
            pageY: 60.21,
            width: 36.97,
            height: 2.85,
          },
        });

        const arg = mockCreate.mock.calls.at(-1)?.[0] as {
          payload: {
            recipients: Array<{
              fields: Array<{
                type: string;
                pageX: number;
                pageY: number;
                width: number;
                height: number;
              }>;
            }>;
          };
        };
        const field = arg.payload.recipients[0].fields[0];
        expect(field.type).toBe("SIGNATURE");
        // Documenso uses 0–100 page percentages. PDF points (>100) placed the
        // field off-page where the signer could not reach it — the historical
        // "sign button doesn't work" bug. Guard the field stays on the page.
        for (const value of [
          field.pageX,
          field.pageY,
          field.width,
          field.height,
        ]) {
          expect(value).toBeGreaterThan(0);
          expect(value).toBeLessThanOrEqual(100);
        }
        expect(field.pageX + field.width).toBeLessThanOrEqual(100);
        expect(field.pageY + field.height).toBeLessThanOrEqual(100);
      });

      it("falls back to an on-page default placement when none is provided", async () => {
        mockCreate.mockResolvedValueOnce({ id: 4, envelopeId: "env_4" });
        mockGet.mockResolvedValueOnce({ id: 4, recipients: [] });

        await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        const arg = mockCreate.mock.calls.at(-1)?.[0] as {
          payload: {
            recipients: Array<{
              fields: Array<{ pageX: number; pageY: number; height: number }>;
            }>;
          };
        };
        const field = arg.payload.recipients[0].fields[0];
        expect(field.pageX).toBeLessThanOrEqual(100);
        expect(field.pageY).toBeLessThanOrEqual(100);
        expect(field.pageY + field.height).toBeLessThanOrEqual(100);
      });

      it("handles DocumensoError", async () => {
        mockCreate.mockRejectedValueOnce(
          new (DocumensoError as any)("API Failed", 400, "Bad Request"),
        );
        await DocumensoService.createDocument({
          pdf: Buffer.from(""),
          signerEmail: "a@a.com",
        });

        expect(logger.error).toHaveBeenCalledWith("API error:", "API Failed");
        expect(logger.error).toHaveBeenCalledWith("Status code:", 400);
        expect(logger.error).toHaveBeenCalledWith("Body:", "Bad Request");
      });
    });

    describe("distributeDocument", () => {
      it("distributes successfully", async () => {
        mockDistribute.mockResolvedValueOnce({ success: true });
        const result = await DocumensoService.distributeDocument({
          documentId: 1,
        });
        expect(result).toEqual({ success: true });
        expect(console.log).toHaveBeenCalledWith("Distribute Response:", {
          success: true,
        });
      });

      it("handles generic Error", async () => {
        mockDistribute.mockRejectedValueOnce(new Error("Network disconnect"));
        await DocumensoService.distributeDocument({ documentId: 1 });
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.any(Error),
        );
      });

      it("handles DocumensoError", async () => {
        mockDistribute.mockRejectedValueOnce(
          new (DocumensoError as any)(
            "Limit reached",
            429,
            "Too many requests",
          ),
        );
        await DocumensoService.distributeDocument({ documentId: 1 });
        expect(logger.error).toHaveBeenCalledWith(
          "API error:",
          "Limit reached",
        );
      });
    });

    describe("getDocumentStatus", () => {
      it("returns the document status reported by Documenso", async () => {
        mockGet.mockResolvedValueOnce({ id: 1, status: "COMPLETED" });

        const status = await DocumensoService.getDocumentStatus({
          documentId: 1,
          apiKey: "custom",
        });

        expect(status).toBe("COMPLETED");
        expect(mockGet).toHaveBeenCalledWith({ documentId: 1 });
      });

      it("returns a non-completed status verbatim rather than coercing it", async () => {
        mockGet.mockResolvedValueOnce({ id: 1, status: "PENDING" });

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 1 }),
        ).resolves.toBe("PENDING");
      });

      it("rethrows a DocumensoError so callers cannot mistake an outage for a signature", async () => {
        mockGet.mockRejectedValueOnce(
          new (DocumensoError as any)("Not found", 404, "No document"),
        );

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 404 }),
        ).rejects.toThrow("Not found");
        expect(logger.error).toHaveBeenCalledWith("API error:", "Not found");
        expect(logger.error).toHaveBeenCalledWith("Status code:", 404);
        expect(logger.error).toHaveBeenCalledWith("Body:", "No document");
      });

      it("rethrows an unexpected error", async () => {
        mockGet.mockRejectedValueOnce(new Error("Network disconnect"));

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 1 }),
        ).rejects.toThrow("Network disconnect");
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.any(Error),
        );
      });
    });

    describe("downloadSignedDocument", () => {
      it("downloads document successfully with override api key", async () => {
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: { downloadUrl: "http://dl" },
        });
        const result = await DocumensoService.downloadSignedDocument({
          documentId: 1,
          apiKey: "custom",
        });
        expect(result).toEqual({ downloadUrl: "http://dl" });
        expect(axios.get).toHaveBeenCalledWith(
          "http://api.documenso.local//document/1/download-beta",
          expect.objectContaining({ headers: { Authorization: "custom" } }),
        );
      });

      it("handles unexpected error in axios", async () => {
        (axios.get as jest.Mock).mockRejectedValueOnce(
          new Error("Download failed"),
        );
        await DocumensoService.downloadSignedDocument({ documentId: 1 });
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.any(Error),
        );
      });
    });

    describe("resolveOrganisationApiKey", () => {
      it("returns the documensoApiKey when the organisation is found", async () => {
        const mockOrgId = "507f1f77bcf86cd799439011";
        (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
          documensoApiKey: "key_obj_regex",
        });

        const key = await DocumensoService.resolveOrganisationApiKey(mockOrgId);
        expect(key).toBe("key_obj_regex");
        expect(prisma.organization.findFirst).toHaveBeenCalledWith({
          where: { OR: [{ id: mockOrgId }, { fhirId: mockOrgId }] },
          select: { documensoApiKey: true },
        });
      });

      it("returns null when the organisation is not found", async () => {
        const mockFhirId = "valid-fhir-id-123";
        (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(
          null,
        );

        const key =
          await DocumensoService.resolveOrganisationApiKey(mockFhirId);
        expect(key).toBeNull();
        expect(prisma.organization.findFirst).toHaveBeenCalledWith({
          where: { OR: [{ id: mockFhirId }, { fhirId: mockFhirId }] },
          select: { documensoApiKey: true },
        });
      });

      it("returns null when the organisation has no documensoApiKey", async () => {
        (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
          documensoApiKey: null,
        });

        const key = await DocumensoService.resolveOrganisationApiKey("org-1");
        expect(key).toBeNull();
      });
    });

    describe("generateExternalRedirectUrl", () => {
      it("returns redirect URL successfully", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: { redirectUrl: "/auth/123" },
        });

        const result = await DocumensoService.generateExternalRedirectUrl({
          email: "x@x.com",
          name: "X",
          businessId: "1",
          businessName: "B",
          role: "ADMIN",
        });

        expect(result).toBe("http://app.documenso.local/auth/123");
      });

      it("throws error if redirectUrl is missing from response", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({ data: {} });
        await expect(
          DocumensoService.generateExternalRedirectUrl({} as any),
        ).rejects.toThrow("Documenso redirect url missing");
        expect(logger.error).toHaveBeenCalled();
      });

      it("throws and logs on network/axios error", async () => {
        const axError = new Error("Network Err");
        (axios.post as jest.Mock).mockRejectedValueOnce(axError);

        await expect(
          DocumensoService.generateExternalRedirectUrl({} as any),
        ).rejects.toThrow("Network Err");
        expect(logger.error).toHaveBeenCalledWith(
          "Documenso external auth error:",
          axError,
        );
      });
    });
  });
});
