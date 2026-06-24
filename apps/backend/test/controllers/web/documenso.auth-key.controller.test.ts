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
import { FormModel, FormSubmissionModel } from "../../../src/models/form";
import OrganizationModel from "../../../src/models/organization";
import UserModel from "../../../src/models/user";
import UserOrganizationModel from "../../../src/models/user-organization";
import {
  DocumensoService,
  type DocumensoExternalRole,
} from "../../../src/services/documenso.service";
import { OrganizationService } from "../../../src/services/organization.service";
import { completePersistedRenderedDocumentSigning } from "../../../src/services/rendered-document.service";
import { prisma } from "../../../src/config/prisma";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => process.env.READ_FROM_POSTGRES === "true"),
}));

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

jest.mock("../../../src/models/form", () => ({
  FormModel: { findById: jest.fn() },
  FormSubmissionModel: { findOne: jest.fn() },
}));

jest.mock("../../../src/models/organization", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), updateOne: jest.fn() },
}));

jest.mock("../../../src/models/user", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

jest.mock("../../../src/models/user-organization", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
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

jest.mock("../../../src/services/rendered-document.service", () => ({
  completePersistedRenderedDocumentSigning: jest.fn(),
}));

jest.mock("../../../src/utils/logger");

const mockedFormModel = FormModel as any;
const mockedFormSubmissionModel = FormSubmissionModel as any;
const mockedOrganizationModel = OrganizationModel as any;
const mockedUserModel = UserModel as any;
const mockedUserOrganizationModel = UserOrganizationModel as any;
const mockedDocumensoService = DocumensoService as any;
const mockedOrganizationService = OrganizationService as any;
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
    delete process.env.READ_FROM_POSTGRES;
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

    it("returns received when no submission exists", async () => {
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");
      mockedFormSubmissionModel.findOne.mockResolvedValue(null);

      await DocumensoWebhookController.handle(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ received: true });
    });

    it("handles completed documents in the mongo branch", async () => {
      const save = jest.fn(() => Promise.resolve(undefined)) as any;
      req.body = makeWebhookRequest("DOCUMENT_COMPLETED");
      mockedFormSubmissionModel.findOne.mockResolvedValue({
        id: "submission-1",
        formId: "form-1",
        signing: { status: "NOT_STARTED", documentId: "123" },
        save,
      });
      mockedFormModel.findById.mockReturnValueOnce({
        lean: jest.fn(() => Promise.resolve({ orgId: "org-1" })) as any,
      });
      mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValue(
        "api-key",
      );
      mockedDocumensoService.downloadSignedDocument.mockResolvedValue({
        downloadUrl: "https://files.example/signed.pdf",
      });
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
      expect(
        mockedCompletePersistedRenderedDocumentSigning,
      ).toHaveBeenCalledWith("rendered-1");
      expect(save).toHaveBeenCalledTimes(1);
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("updates completed documents in the postgres branch", async () => {
      req.body = makeWebhookRequest("DOCUMENT_DELETED");
      process.env.READ_FROM_POSTGRES = "true";
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
      mockedUserModel.findOne.mockReturnValue({
        lean: jest.fn(() => Promise.resolve(null)) as any,
      });

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
      mockedUserModel.findOne.mockReturnValue({
        lean: jest.fn(() =>
          Promise.resolve({
            email: "owner@example.com",
            firstName: "Owner",
            lastName: "User",
          }),
        ) as any,
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

    it("generates a redirect URL in the mongo branch", async () => {
      req.params = { orgId: "org-1" };
      (req as any).userId = "user-1";
      mockedUserModel.findOne.mockReturnValue({
        lean: jest.fn(() =>
          Promise.resolve({
            email: "owner@example.com",
            firstName: "Owner",
            lastName: "User",
          }),
        ) as any,
      });
      mockedOrganizationService.getById.mockResolvedValue({
        id: "org-1",
        name: "Acme Vet",
      });
      mockedUserOrganizationModel.findOne.mockReturnValue({
        lean: jest.fn(() => Promise.resolve({ roleCode: "OWNER" })) as any,
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

    it("uses postgres lookups when read-switch is enabled", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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
        role: "MANAGER",
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
      req.params = { orgId: "not valid!" };
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
    });

    it("stores the key in mongo", async () => {
      req.params = { orgId: "org-1" };
      req.body = { apiToken: "token-1" };
      req.headers = {
        "x-documenso-signature": buildSignature(
          Buffer.from(JSON.stringify({ apiToken: "token-1" })),
          "key-secret",
        ),
      };
      mockedOrganizationModel.findOne.mockReturnValue({
        lean: jest.fn(() =>
          Promise.resolve({
            _id: "mongo-org-1",
          }),
        ) as any,
      });

      await DocumensoKeyController.storeApiKey(
        req as Request<{ orgId: string }>,
        res as Response,
      );

      expect(mockedOrganizationModel.updateOne).toHaveBeenCalledWith(
        { _id: "mongo-org-1" },
        { $set: { documensoApiKey: "token-1" } },
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("returns success when the key already exists in postgres", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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
  });
});
