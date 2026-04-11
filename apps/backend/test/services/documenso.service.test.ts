/* eslint-disable @typescript-eslint/no-var-requires */
// test/services/documenso.service.test.ts
import axios from "axios";
import OrganizationModel from "../../src/models/organization";
import logger from "../../src/utils/logger";
import { DocumensoError } from "@documenso/sdk-typescript/models/errors/index.js";

// --- MOCK SETUP ---
jest.mock("axios");

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn(),
    }),
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

const mockCreateV0 = jest.fn();
const mockDistribute = jest.fn();

jest.mock("@documenso/sdk-typescript", () => {
  return {
    Documenso: jest.fn().mockImplementation(() => ({
      documents: {
        createV0: mockCreateV0,
        distribute: mockDistribute,
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

// Set up global fetch mock
globalThis.fetch = jest.fn();

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
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
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
        mockCreateV0.mockResolvedValueOnce({
          document: { id: "doc_1" },
          uploadUrl: "http://upload",
        });
        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        expect(result).toEqual({ id: "doc_1" });
        expect(mockCreateV0).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: expect.arrayContaining([
              expect.objectContaining({ name: "test@test.com" }),
            ]),
          }),
        );
        expect(globalThis.fetch).toHaveBeenCalledWith(
          "http://upload",
          expect.any(Object),
        );
      });

      it("uses provided signerName and caches Documenso Client", async () => {
        mockCreateV0.mockResolvedValue({
          document: { id: "doc_2" },
          uploadUrl: "http://upload",
        });

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

        expect(result).toEqual({ id: "doc_2" });
        expect(mockCreateV0).toHaveBeenCalledWith(
          expect.objectContaining({
            recipients: expect.arrayContaining([
              expect.objectContaining({ name: "John Doe" }),
            ]),
          }),
        );
      });

      it("throws when uploadPdfBuffer fetch fails (!response.ok)", async () => {
        (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status: 502,
        });
        mockCreateV0.mockResolvedValueOnce({
          document: {},
          uploadUrl: "http://upload",
        });

        await DocumensoService.createDocument({
          pdf: Buffer.from(""),
          signerEmail: "a@a.com",
        });
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.objectContaining({ message: "Upload failed: 502" }),
        );
      });

      it("handles DocumensoError", async () => {
        mockCreateV0.mockRejectedValueOnce(
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

    describe("resolveOrganisationApiKey & buildOrganizationLookupQuery", () => {
      it("generates $or query if both Types.ObjectId and regex match", async () => {
        const mockOrgId = "507f1f77bcf86cd799439011";
        (OrganizationModel.findOne as jest.Mock).mockReturnValueOnce({
          lean: jest
            .fn()
            .mockResolvedValue({ documensoApiKey: "key_obj_regex" }),
        });

        const key = await DocumensoService.resolveOrganisationApiKey(mockOrgId);
        expect(key).toBe("key_obj_regex");
        expect(OrganizationModel.findOne).toHaveBeenCalledWith(
          { $or: [{ _id: mockOrgId }, { fhirId: mockOrgId }] },
          { documensoApiKey: 1 },
        );
      });

      it("generates single query if only regex matches", async () => {
        const mockFhirId = "valid-fhir-id-123";
        (OrganizationModel.findOne as jest.Mock).mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue(null),
        });

        const key =
          await DocumensoService.resolveOrganisationApiKey(mockFhirId);
        expect(key).toBeNull();
        expect(OrganizationModel.findOne).toHaveBeenCalledWith(
          { fhirId: mockFhirId },
          { documensoApiKey: 1 },
        );
      });

      it("throws error if neither matches (empty queries array)", async () => {
        const invalidId = "invalid id with spaces !!";
        await expect(
          DocumensoService.resolveOrganisationApiKey(invalidId),
        ).rejects.toThrow("Invalid organisation id");
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
