/* eslint-disable @typescript-eslint/no-var-requires */
// test/services/documenso.service.test.ts
import axios from "axios";
import { prisma } from "src/config/prisma";
import logger from "../../src/utils/logger";
import { SDK_METADATA } from "@documenso/sdk-typescript/lib/config.js";
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

const mockDistribute = jest.fn();

// Only the envelope distribute goes through the SDK. A call to any deprecated
// documents.* method, or to the SDK envelope reads that reject Documenso
// 2.4.0's responses, throws here.
jest.mock("@documenso/sdk-typescript", () => {
  return {
    Documenso: jest.fn().mockImplementation(() => ({
      envelopes: {
        distribute: mockDistribute,
      },
    })),
  };
});

// The create answer Documenso 2.4.0 gives (its ZCreateDocumentResponseSchema).
const created = (id: number, envelopeId: string) => ({
  data: { envelopeId, id },
});

// What createDocument posted to /document/create, read as Documenso reads it.
const postedCreate = () => {
  const [url, form, config] = (axios.post as jest.Mock).mock.calls.at(-1) as [
    string,
    FormData,
    { headers: Record<string, string> },
  ];
  return {
    url,
    payload: JSON.parse(form.get("payload") as string),
    file: form.get("file") as File,
    headers: config.headers,
  };
};

/*
 * An envelope exactly as Documenso 2.4.0 (what production runs) returns it:
 * the keys of its ZEnvelopeSchema and ZEnvelopeRecipientLiteSchema. It has no
 * recipients[].expiresAt or expirationNotifiedAt, no
 * documentMeta.envelopeExpirationPeriod and no envelopeItems[].documentDataId,
 * which SDK 0.9.1 requires, so the SDK rejected this very response.
 */
const envelope240 = (status: string, token: string) => ({
  internalVersion: 1,
  type: "DOCUMENT",
  status,
  source: "DOCUMENT",
  visibility: "EVERYONE",
  templateType: "PRIVATE",
  id: "envelope_1",
  secondaryId: "document_1",
  externalId: null,
  createdAt: "2026-09-24T08:00:00.000Z",
  updatedAt: "2026-09-24T08:00:00.000Z",
  completedAt: null,
  deletedAt: null,
  title: "Form Submission",
  authOptions: { globalAccessAuth: [], globalActionAuth: [] },
  formValues: null,
  publicTitle: "",
  publicDescription: "",
  userId: 7,
  teamId: 3,
  folderId: null,
  templateId: null,
  documentMeta: {
    signingOrder: "PARALLEL",
    distributionMethod: "EMAIL",
    id: "meta_1",
    subject: null,
    message: null,
    timezone: "Etc/UTC",
    dateFormat: "yyyy-MM-dd hh:mm a",
    redirectUrl: null,
    typedSignatureEnabled: true,
    uploadSignatureEnabled: true,
    drawSignatureEnabled: true,
    allowDictateNextSigner: false,
    language: "en",
    emailSettings: null,
    emailId: null,
    emailReplyTo: null,
  },
  recipients: [
    {
      envelopeId: "envelope_1",
      role: "SIGNER",
      readStatus: "NOT_OPENED",
      signingStatus: "NOT_SIGNED",
      sendStatus: "NOT_SENT",
      id: 11,
      email: "vet@example.com",
      name: "Vet",
      token,
      documentDeletedAt: null,
      expired: null,
      signedAt: null,
      authOptions: { accessAuth: [], actionAuth: [] },
      signingOrder: null,
      rejectionReason: null,
    },
  ],
  fields: [],
  envelopeItems: [
    { envelopeId: "envelope_1", id: "item_1", title: "document.pdf", order: 1 },
  ],
  directLink: null,
  team: { id: 3, url: "team" },
  user: { id: 7, name: "Owner", email: "owner@example.com" },
});

// The axios error shape: the outbound request, API key included, hangs off it.
const axiosError = (message: string, apiKeyValue: string, status: number) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    config: {
      url: "http://api.documenso.local/envelope/get-many",
      headers: { Authorization: apiKeyValue },
    },
    response: { status },
  });

const everythingLogged = () =>
  JSON.stringify([
    (logger.info as jest.Mock).mock.calls,
    (logger.warn as jest.Mock).mock.calls,
    (logger.error as jest.Mock).mock.calls,
  ]);

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
  // What the SDK throws when a reply does not match its response schema.
  class MockResponseValidationError extends MockDocumensoError {}
  return {
    DocumensoError: MockDocumensoError,
    ResponseValidationError: MockResponseValidationError,
    __esModule: true,
  };
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
        "Documenso signed-document download failed",
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
        (axios.post as jest.Mock).mockResolvedValueOnce(created(1, "env_1"));
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: {
            id: "env_1",
            secondaryId: "document_1",
            recipients: [{ id: 11, token: "synthetic-recipient-token" }],
          },
        });
        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        // The numeric id callers persist, the envelope id they distribute by,
        // and the recipient token the signing URL is built from.
        expect(result).toEqual({
          id: 1,
          envelopeId: "env_1",
          recipients: [{ id: 11, token: "synthetic-recipient-token" }],
        });
        // POST /document/create, the route the SDK's documents.create called,
        // with its headers and its two multipart parts.
        const posted = postedCreate();
        expect(posted.url).toBe("http://api.documenso.local/document/create");
        expect(posted.headers).toEqual({
          Accept: "application/json",
          Authorization: "valid_api_key",
          "User-Agent": SDK_METADATA.userAgent,
        });
        expect(posted.payload.recipients).toEqual([
          expect.objectContaining({
            email: "test@test.com",
            name: "test@test.com",
          }),
        ]);
        expect(posted.file.name).toBe("document.pdf");
        expect(posted.file.type).toBe("application/pdf");
        expect(Buffer.from(await posted.file.arrayBuffer()).toString()).toBe(
          "test",
        );
        // GET /envelope/{id}, the route the SDK's envelopes.get calls, with
        // the key the SDK sends.
        expect(axios.get).toHaveBeenCalledWith(
          "http://api.documenso.local/envelope/env_1",
          { headers: { Authorization: "valid_api_key" } },
        );
      });

      it("reads the signing token from a Documenso 2.4.0 envelope", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce(
          created(1, "envelope_1"),
        );
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: envelope240("DRAFT", "synthetic-recipient-token"),
        });

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "vet@example.com",
          apiKey: "org_key",
        });

        expect(result).toEqual({
          id: 1,
          envelopeId: "envelope_1",
          recipients: [
            expect.objectContaining({
              id: 11,
              token: "synthetic-recipient-token",
            }),
          ],
        });
        expect(postedCreate().headers.Authorization).toBe("org_key");
        expect(axios.get).toHaveBeenCalledWith(
          "http://api.documenso.local/envelope/envelope_1",
          { headers: { Authorization: "org_key" } },
        );
      });

      it("resolves both requests under the base URL's path, with or without a trailing slash", async () => {
        for (const base of [
          "https://ds.example/api/v2",
          "https://ds.example/api/v2/",
        ]) {
          const Service = getModule({
            DOCUMENSO_BASE_URL: base,
            DOCUMENSO_API_KEY: "valid_api_key",
          });
          (axios.post as jest.Mock).mockResolvedValueOnce(created(1, "env/1"));
          (axios.get as jest.Mock).mockResolvedValueOnce({
            data: { recipients: [] },
          });

          await Service.createDocument({
            pdf: Buffer.from("test"),
            signerEmail: "test@test.com",
          });

          expect(postedCreate().url).toBe(
            "https://ds.example/api/v2/document/create",
          );
          // The id is one path segment, whatever it holds.
          expect((axios.get as jest.Mock).mock.calls.at(-1)?.[0]).toBe(
            "https://ds.example/api/v2/envelope/env%2F1",
          );
        }
      });

      it("uses the provided signerName and title", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce(created(2, "env_2"));
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: { id: "env_2", recipients: [] },
        });

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          signerName: "John Doe",
          title: "Consent form",
        });

        expect(result).toEqual({ id: 2, envelopeId: "env_2", recipients: [] });
        expect(postedCreate().payload).toEqual(
          expect.objectContaining({
            title: "Consent form",
            recipients: [
              expect.objectContaining({
                email: "test@test.com",
                name: "John Doe",
              }),
            ],
          }),
        );
      });

      it("sends the signature field on-page so the signer can reach it", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce(created(3, "env_3"));
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: { id: "env_3", recipients: [] },
        });

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

        const field = postedCreate().payload.recipients[0].fields[0];
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
        (axios.post as jest.Mock).mockResolvedValueOnce(created(4, "env_4"));
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: { id: "env_4", recipients: [] },
        });

        await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        const field = postedCreate().payload.recipients[0].fields[0];
        expect(field.pageX).toBeLessThanOrEqual(100);
        expect(field.pageY).toBeLessThanOrEqual(100);
        expect(field.pageY + field.height).toBeLessThanOrEqual(100);
      });

      /*
       * The create request carries the API key as a header, so the axios error
       * for a failed create carries it in `config.headers`. The document was
       * not made, so there is nothing to look up either.
       */
      it("handles a failed create without logging the API key", async () => {
        const apiKeyValue = "documenso-api-key-placeholder";
        (axios.post as jest.Mock).mockRejectedValueOnce(
          axiosError("Request failed with status code 401", apiKeyValue, 401),
        );

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          apiKey: apiKeyValue,
        });

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          { message: "Request failed with status code 401", status: 401 },
        );
        expect(everythingLogged()).not.toContain(apiKeyValue);
        expect(axios.get).not.toHaveBeenCalled();
      });

      // Parsed as strictly as the SDK parsed it: both ids, with their types.
      it("fails, without logging the answer, when the create answer is not a document", async () => {
        const token = "recipient-signing-token-placeholder";
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: { id: "1", envelopeId: 1, note: token },
        });

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.objectContaining({
            message: expect.stringContaining("envelopeId"),
          }),
        );
        expect(everythingLogged()).not.toContain(token);
        expect(axios.get).not.toHaveBeenCalled();
      });

      it("handles a failed lookup after the document is created", async () => {
        const apiKeyValue = "documenso-api-key-placeholder";
        (axios.post as jest.Mock).mockResolvedValueOnce(created(5, "env_5"));
        (axios.get as jest.Mock).mockRejectedValueOnce(
          axiosError("Request failed with status code 503", apiKeyValue, 503),
        );

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
          apiKey: apiKeyValue,
        });

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          { message: "Request failed with status code 503", status: 503 },
        );
        expect(everythingLogged()).not.toContain(apiKeyValue);
      });

      it("fails, without logging the token, when the envelope has no usable recipients", async () => {
        const token = "recipient-signing-token-placeholder";
        (axios.post as jest.Mock).mockResolvedValueOnce(created(6, "env_6"));
        (axios.get as jest.Mock).mockResolvedValueOnce({
          data: { recipients: [{ id: 1, signingToken: token }] },
        });

        const result = await DocumensoService.createDocument({
          pdf: Buffer.from("test"),
          signerEmail: "test@test.com",
        });

        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.objectContaining({
            message: expect.stringContaining("token"),
          }),
        );
        expect(everythingLogged()).not.toContain(token);
      });
    });

    // Whether the envelope went: a success reply the SDK's strict schema
    // rejects still went; an error reply of any shape did not.
    describe("sendEnvelope", () => {
      // The service and the SDK's error classes from one module registry, so
      // an error made here is an instance of the class the service checks.
      let Service: any;
      let sdkErrors: any;
      beforeAll(() => {
        jest.isolateModules(() => {
          const originalEnv = process.env;
          process.env = {
            ...originalEnv,
            DOCUMENSO_BASE_URL: "https://documenso.example/api",
            DOCUMENSO_API_KEY: "valid_api_key",
          };
          Service =
            require("../../src/services/documenso.service").DocumensoService;
          sdkErrors = require("@documenso/sdk-typescript/models/errors/index.js");
          process.env = originalEnv;
        });
      });
      const schemaRejected = (statusCode: number) =>
        Object.assign(
          Object.create(sdkErrors.ResponseValidationError.prototype),
          { statusCode, message: "Response validation failed" },
        );

      it.each([
        [
          "an accepted reply",
          () => mockDistribute.mockResolvedValueOnce({}),
          true,
        ],
        [
          "a success reply the schema rejects",
          () => mockDistribute.mockRejectedValueOnce(schemaRejected(200)),
          true,
        ],
        [
          "an error reply the schema rejects",
          () => mockDistribute.mockRejectedValueOnce(schemaRejected(500)),
          false,
        ],
        [
          "no answer",
          () =>
            mockDistribute.mockRejectedValueOnce(new Error("socket hang up")),
          false,
        ],
      ])("reports %s as sent: %s", async (_label, arrange, expected) => {
        arrange();

        await expect(
          Service.sendEnvelope({ envelopeId: "env_1" }),
        ).resolves.toBe(expected);
        expect(mockDistribute).toHaveBeenCalledWith({ envelopeId: "env_1" });
      });
    });

    describe("distributeDocument", () => {
      it("distributes the envelope and returns Documenso's response", async () => {
        const response = { success: true, id: "env_1", recipients: [] };
        mockDistribute.mockResolvedValueOnce(response);
        const result = await DocumensoService.distributeDocument({
          envelopeId: "env_1",
        });
        expect(result).toEqual(response);
        expect(mockDistribute).toHaveBeenCalledWith({ envelopeId: "env_1" });
        expect(logger.info).toHaveBeenCalledWith(
          "Documenso envelope distributed",
          { envelopeId: "env_1" },
        );
      });

      /*
       * The envelope distribute response lists every recipient with the token
       * and signing URL that let anyone holding them sign. Assert on everything
       * logged, however it is logged, so a later "just dump the response"
       * reddens here.
       */
      it("never writes a recipient's signing token into the log", async () => {
        const token = "recipient-signing-token-placeholder";
        mockDistribute.mockResolvedValueOnce({
          success: true,
          id: "env_1",
          recipients: [
            {
              id: 1,
              token,
              signingUrl: `http://app.documenso.local/sign/${token}`,
            },
          ],
        });

        await DocumensoService.distributeDocument({ envelopeId: "env_1" });

        const logged = [
          (console.log as jest.Mock).mock.calls,
          (logger.info as jest.Mock).mock.calls,
          (logger.error as jest.Mock).mock.calls,
        ];
        expect(JSON.stringify(logged)).not.toContain(token);
      });

      it("handles generic Error", async () => {
        mockDistribute.mockRejectedValueOnce(new Error("Network disconnect"));
        const result = await DocumensoService.distributeDocument({
          envelopeId: "env_1",
        });
        expect(result).toBeUndefined();
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          { message: "Network disconnect", status: undefined },
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
        await DocumensoService.distributeDocument({ envelopeId: "env_1" });
        expect(logger.error).toHaveBeenCalledWith(
          "API error:",
          "Limit reached",
        );
        expect(logger.error).toHaveBeenCalledWith("Status code:", 429);
      });

      // The distribute response is the one that lists every signing URL.
      it("never writes a distribute response the SDK rejected into the log", async () => {
        const token = "recipient-signing-token-placeholder";
        mockDistribute.mockRejectedValueOnce(
          new (DocumensoError as any)(
            "Response validation failed",
            200,
            JSON.stringify({
              recipients: [{ token, signingUrl: `http://ds/sign/${token}` }],
            }),
          ),
        );

        await DocumensoService.distributeDocument({ envelopeId: "env_1" });

        expect(logger.error).toHaveBeenCalledWith(
          "API error:",
          "Response validation failed",
        );
        expect(everythingLogged()).not.toContain(token);
      });
    });

    describe("getDocumentStatus", () => {
      it("returns the document status reported by Documenso", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: {
            data: [
              { id: "env_1", secondaryId: "document_1", status: "COMPLETED" },
            ],
          },
        });

        const status = await DocumensoService.getDocumentStatus({
          documentId: 1,
          apiKey: "custom",
        });

        expect(status).toBe("COMPLETED");
        // POST /envelope/get-many, the route the SDK's envelopeGetMany calls,
        // by the numeric id callers persist rather than an envelope id.
        expect(axios.post).toHaveBeenCalledWith(
          "http://api.documenso.local/envelope/get-many",
          { ids: { type: "documentId", ids: [1] } },
          { headers: { Authorization: "custom" } },
        );
      });

      it("reads the status from a Documenso 2.4.0 envelope", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: { data: [envelope240("COMPLETED", "synthetic-token")] },
        });

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 1 }),
        ).resolves.toBe("COMPLETED");
        expect(axios.post).toHaveBeenCalledWith(
          "http://api.documenso.local/envelope/get-many",
          { ids: { type: "documentId", ids: [1] } },
          { headers: { Authorization: "valid_api_key" } },
        );
      });

      it("returns a non-completed status verbatim rather than coercing it", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: { data: [{ id: "env_1", status: "PENDING" }] },
        });

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 1 }),
        ).resolves.toBe("PENDING");
      });

      // A status this service does not know is not an answer to act on.
      it("throws on a status outside Documenso's enum", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({
          data: { data: [{ id: "env_1", status: "SIGNED" }] },
        });

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 1 }),
        ).rejects.toThrow("status");
      });

      /*
       * The legacy lookup answered an unknown id with a 404. The envelope
       * lookup answers with an empty list instead, which must still be an
       * error: an absent document is not a status.
       */
      it("throws when Documenso has no document with that id", async () => {
        (axios.post as jest.Mock).mockResolvedValueOnce({ data: { data: [] } });

        await expect(
          DocumensoService.getDocumentStatus({ documentId: 404 }),
        ).rejects.toThrow("Documenso document 404 not found");
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          expect.objectContaining({
            message: "Documenso document 404 not found",
          }),
        );
      });

      /*
       * Rethrown so callers cannot mistake an outage for a signature, but not
       * as the axios error itself: its request config holds the API key, and
       * the webhook controller logs whatever it catches.
       */
      it("rethrows a failed lookup without the API key", async () => {
        const apiKeyValue = "documenso-api-key-placeholder";
        (axios.post as jest.Mock).mockRejectedValueOnce(
          axiosError("Request failed with status code 503", apiKeyValue, 503),
        );

        const thrown = await DocumensoService.getDocumentStatus({
          documentId: 1,
          apiKey: apiKeyValue,
        }).catch((error: unknown) => error);

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toBe(
          "Request failed with status code 503",
        );
        expect(JSON.stringify(thrown)).not.toContain(apiKeyValue);
        expect(logger.error).toHaveBeenCalledWith(
          "An unexpected error occurred:",
          { message: "Request failed with status code 503", status: 503 },
        );
        expect(everythingLogged()).not.toContain(apiKeyValue);
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
          "Documenso signed-document download failed",
          expect.objectContaining({ message: "Download failed" }),
        );
      });

      /*
       * The property, not the wording. Axios hangs the outbound request off the
       * error as `config`, so logging the error object writes
       * `config.headers.Authorization` - the Documenso API key - into the log.
       * The logger does not redact it: production is `json()`, which serialises
       * the whole meta, and the development field list replaces `req`, `res`,
       * `request` and `response` but not `config`, because it exists to keep log
       * lines small rather than to redact.
       *
       * So this asserts on the SERIALISED arguments rather than on their shape:
       * a future change that logs the raw error again reddens here whatever it
       * calls the message.
       */
      it("never writes the API key into the log when the download fails", async () => {
        const apiKeyValue = "documenso-api-key-placeholder";
        (axios.get as jest.Mock).mockRejectedValueOnce(
          Object.assign(new Error("Download failed"), {
            isAxiosError: true,
            config: {
              url: "http://valid.com/document/1/download-beta",
              headers: { Authorization: apiKeyValue },
            },
            response: { status: 502 },
          }),
        );

        await DocumensoService.downloadSignedDocument({ documentId: 1 });

        const logged = (logger.error as jest.Mock).mock.calls.at(-1);
        expect(JSON.stringify(logged)).not.toContain(apiKeyValue);
        expect(logged?.[1]).toEqual(
          expect.objectContaining({ message: "Download failed", status: 502 }),
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
          "Documenso external auth error",
          expect.objectContaining({ message: "Network Err" }),
        );
      });

      /*
       * The same property on the other call site, where the credential is in
       * the request BODY rather than a header - axios attaches that to the
       * error as `config.data`, so the shape of the leak differs and the fix
       * and the check do not.
       */
      it("never writes the external auth secret into the log when the call fails", async () => {
        const secretValue = "external-auth-secret-placeholder";
        (axios.post as jest.Mock).mockRejectedValueOnce(
          Object.assign(new Error("Network Err"), {
            isAxiosError: true,
            config: {
              url: "http://valid.com/api/auth/external/generate-token",
              data: JSON.stringify({ externalSecret: secretValue }),
            },
            response: { status: 500 },
          }),
        );

        await expect(
          DocumensoService.generateExternalRedirectUrl({} as any),
        ).rejects.toThrow("Network Err");

        const logged = (logger.error as jest.Mock).mock.calls.at(-1);
        expect(JSON.stringify(logged)).not.toContain(secretValue);
        expect(logged?.[1]).toEqual(
          expect.objectContaining({ message: "Network Err", status: 500 }),
        );
      });
    });
  });
});
