import crypto from "node:crypto";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Request, Response } from "express";
import {
  DocumensoAuthController,
  DocumensoKeyController,
  DocumensoWebhookController,
} from "../../../src/controllers/web/documenso.controller";
import {
  DocumensoService,
  type DocumensoExternalRole,
} from "../../../src/services/documenso.service";
import { OrganizationService } from "../../../src/services/organization.service";
import { FormAssignmentService } from "../../../src/services/form-assignment.service";
import { completePersistedRenderedDocumentSigning } from "../../../src/services/rendered-document.service";
import { prisma } from "../../../src/config/prisma";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    form: { findUnique: jest.fn() },
    formSubmission: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    renderedDocument: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    workspaceDocumentPacket: {
      findFirst: jest.fn(),
    },
    user: { findFirst: jest.fn() },
    userOrganization: { findFirst: jest.fn() },
  },
}));

jest.mock("../../../src/services/documenso.service", () => ({
  DocumensoService: {
    downloadSignedDocument: jest.fn(),
    generateExternalRedirectUrl: jest.fn(),
    resolveOrganisationApiKey: jest.fn(),
  },
}));

jest.mock("../../../src/services/organization.service", () => ({
  OrganizationService: {
    getById: jest.fn(),
  },
}));

jest.mock("../../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    markSignedFromSubmission: jest.fn(),
  },
}));

jest.mock("../../../src/services/rendered-document.service", () => ({
  completePersistedRenderedDocumentSigning: jest.fn(),
}));

jest.mock("../../../src/utils/logger");

const mockedDocumensoService = DocumensoService as any;
const mockedOrganizationService = OrganizationService as any;
const mockedFormAssignmentService = FormAssignmentService as any;
const mockedCompletePersistedRenderedDocumentSigning =
  completePersistedRenderedDocumentSigning as any;
const mockedPrisma = prisma as any;
const mockedLogger = logger as any;

describe("Documenso controllers", () => {
  const originalWebhookSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;
  const originalKeySecret = process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let endMock: jest.Mock;

  const buildSignature = (payload: Buffer, secret: string) =>
    crypto.createHmac("sha256", secret).update(payload).digest("hex");

  const makeWebhookRequest = (event?: string, id = 123) => {
    const payload = Buffer.from(
      JSON.stringify({
        event,
        payload: { id },
      }),
    );
    return payload;
  };

  beforeAll(() => {
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
    delete process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.DOCUMENSO_WEBHOOK_SECRET;
    } else {
      process.env.DOCUMENSO_WEBHOOK_SECRET = originalWebhookSecret;
    }

    if (originalKeySecret === undefined) {
      delete process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;
    } else {
      process.env.DOCUMENSO_PMS_WEBHOOK_SECRET = originalKeySecret;
    }
  });

  beforeEach(() => {
    jsonMock = jest.fn();
    endMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, end: endMock });

    req = {
      body: Buffer.from("{}"),
      headers: {},
      params: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      end: endMock,
    } as unknown as Response;

    jest.clearAllMocks();
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
    delete process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;
  });

  describe("DocumensoWebhookController", () => {
    it("rejects invalid payloads", async () => {
      req.body = Buffer.from(
        JSON.stringify({
          event: undefined,
          payload: { id: "doc-123" },
        }),
      );

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(mockedLogger.error).toHaveBeenCalledWith(
        "[DocumensoWebhook] Invalid payload",
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("rejects missing signatures when verification is enabled", async () => {
      process.env.DOCUMENSO_WEBHOOK_SECRET = "top-secret";
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(endMock).toHaveBeenCalled();
    });

    it("rejects invalid signatures when verification is enabled", async () => {
      process.env.DOCUMENSO_WEBHOOK_SECRET = "top-secret";
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");
      req.headers = {
        "x-documenso-signature": "0".repeat(64),
      };

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(endMock).toHaveBeenCalled();
    });

    it("returns received when no submission or packet exists", async () => {
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");
      mockedPrisma.formSubmission.findFirst.mockResolvedValue(null);
      mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(null);

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ received: true });
    });

    it("handles completed documents", async () => {
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");
      mockedPrisma.formSubmission.findFirst.mockResolvedValue({
        id: "submission-1",
        formId: "form-1",
        formVersion: 1,
        appointmentId: null,
        patientId: null,
        parentId: null,
        signing: { status: "NOT_STARTED", documentId: "123" },
      });
      mockedPrisma.form.findUnique.mockResolvedValue({ orgId: "org-1" });
      mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValue(
        "api-key",
      );
      mockedDocumensoService.downloadSignedDocument.mockResolvedValue({
        downloadUrl: "https://files.example/signed.pdf",
      });
      mockedFormAssignmentService.markSignedFromSubmission.mockResolvedValue(
        undefined,
      );
      mockedPrisma.renderedDocument.findFirst.mockResolvedValue({
        id: "rendered-1",
      });

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(
        mockedDocumensoService.downloadSignedDocument,
      ).toHaveBeenCalledWith({
        documentId: 123,
        apiKey: "api-key",
      });
      expect(mockedPrisma.formSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "submission-1" },
          data: expect.objectContaining({
            signing: expect.objectContaining({ status: "SIGNED" }),
          }),
        }),
      );
      expect(
        mockedCompletePersistedRenderedDocumentSigning,
      ).toHaveBeenCalledWith("rendered-1");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("resets signing when documents are deleted", async () => {
      req.body = makeWebhookRequest("DOCUMENT_DELETED");
      mockedPrisma.formSubmission.findFirst.mockResolvedValue({
        id: "submission-2",
        formId: "form-2",
        signing: { status: "NOT_STARTED", documentId: "456" },
      });
      mockedPrisma.renderedDocument.findFirst.mockResolvedValue(null);

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(mockedPrisma.formSubmission.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "submission-2" },
          data: expect.objectContaining({
            signing: expect.objectContaining({
              documentId: "456",
              status: "NOT_STARTED",
            }),
          }),
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("DocumensoAuthController", () => {
    it("returns 400 when user or organisation id is missing", async () => {
      await DocumensoAuthController.createRedirectUrl(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Missing userId or orgId.",
      });
    });

    it("returns 404 when the user is missing", async () => {
      req.params = { orgId: "org-1" };
      (req as any).userId = "user-1";
      mockedPrisma.user.findFirst.mockResolvedValue(null);

      await DocumensoAuthController.createRedirectUrl(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "User not found." });
    });

    it("returns 404 when the organisation is missing", async () => {
      req.params = { orgId: "org-1" };
      (req as any).userId = "user-1";
      mockedPrisma.user.findFirst.mockResolvedValue({
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      });
      mockedOrganizationService.getById.mockResolvedValue(null);

      await DocumensoAuthController.createRedirectUrl(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation not found.",
      });
    });

    it("generates a redirect URL and maps owners to ADMIN", async () => {
      req.params = { orgId: "org-1" };
      (req as any).userId = "user-1";
      mockedPrisma.user.findFirst.mockResolvedValue({
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      });
      mockedOrganizationService.getById.mockResolvedValue({
        id: "org-1",
        name: "Acme Vet",
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValue({
        roleCode: "OWNER",
      });
      mockedDocumensoService.generateExternalRedirectUrl.mockResolvedValue(
        "https://documenso.example/auth",
      );

      await DocumensoAuthController.createRedirectUrl(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(
        mockedDocumensoService.generateExternalRedirectUrl,
      ).toHaveBeenCalledWith({
        email: "owner@example.com",
        name: "Owner User",
        businessId: "org-1",
        businessName: "Acme Vet",
        role: "ADMIN" satisfies DocumensoExternalRole,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps supervisors to MANAGER", async () => {
      req.params = { orgId: "org-1" };
      (req as any).userId = "user-1";
      mockedPrisma.user.findFirst.mockResolvedValue({
        email: "pg-owner@example.com",
        firstName: "Pg",
        lastName: "Owner",
      });
      mockedOrganizationService.getById.mockResolvedValue({
        id: "pg-org-1",
        name: "Pg Vet",
      });
      mockedPrisma.userOrganization.findFirst.mockResolvedValue({
        roleCode: "SUPERVISOR",
      });
      mockedDocumensoService.generateExternalRedirectUrl.mockResolvedValue(
        "https://documenso.example/auth/pg",
      );

      await DocumensoAuthController.createRedirectUrl(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(
        mockedDocumensoService.generateExternalRedirectUrl,
      ).toHaveBeenCalledWith({
        email: "pg-owner@example.com",
        name: "Pg Owner",
        businessId: "pg-org-1",
        businessName: "Pg Vet",
        role: "MANAGER" satisfies DocumensoExternalRole,
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("DocumensoKeyController", () => {
    beforeEach(() => {
      process.env.DOCUMENSO_PMS_WEBHOOK_SECRET = "key-secret";
    });

    it("returns 500 when the webhook secret is missing", async () => {
      delete process.env.DOCUMENSO_PMS_WEBHOOK_SECRET;
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = { "x-documenso-signature": "0".repeat(64) };

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("returns 401 when the signature is missing", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("returns 401 when the signature is invalid", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = { "x-documenso-signature": "0".repeat(64) };

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("returns 400 when apiToken is missing", async () => {
      req.params = { orgId: "org-1" };
      req.body = {};
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from("{}"),
          "key-secret",
        ),
      };

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "apiToken is required.",
      });
    });

    it("returns 400 for an invalid organisation id", async () => {
      req.params = { orgId: "   " };
      req.body = { apiToken: "token-1" };
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from(JSON.stringify({ apiToken: "token-1" })),
          "key-secret",
        ),
      };

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Invalid organisation id.",
      });
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Documenso key webhook invalid org id",
        { orgId: "[redacted]" },
      );
    });

    it("stores the key when the organisation has none", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from(JSON.stringify({ apiToken: "token-1" })),
          "key-secret",
        ),
      };
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "pg-org-1",
        documensoApiKey: null,
      });

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(mockedPrisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: "pg-org-1" },
        data: { documensoApiKey: "token-1" },
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    it("returns success when the key already exists", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from(JSON.stringify({ apiToken: "token-1" })),
          "key-secret",
        ),
      };
      mockedPrisma.organization.findFirst.mockResolvedValue({
        id: "org-1",
        documensoApiKey: "existing-key",
      });

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(mockedPrisma.organization.updateMany).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns 404 when the organisation is not found", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from(JSON.stringify({ apiToken: "token-1" })),
          "key-secret",
        ),
      };
      mockedPrisma.organization.findFirst.mockResolvedValue(null);

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Organisation not found.",
      });
    });
  });
});
