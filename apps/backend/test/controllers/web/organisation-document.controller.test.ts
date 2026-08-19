import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { OrganizationDocumentController } from "../../../src/controllers/web/organisation-document.controller";
import {
  AcknowledgeOrgDocumentInput,
  DocumentAcknowledgementStatus,
  LegalDocumentResponse,
  LegalDocumentType,
  OrgDocumentServiceError,
  OrganizationDocumentService,
} from "../../../src/services/organisation-document.service";
import { generatePresignedUrl } from "../../../src/middlewares/upload";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/organisation-document.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/organisation-document.service",
  ) as typeof import("../../../src/services/organisation-document.service");
  return {
    ...actual,
    OrganizationDocumentService: {
      ...actual.OrganizationDocumentService,
      getFixedLegalDocument: jest.fn(),
      acknowledgeDocument: jest.fn(),
      getAcknowledgementStatus: jest.fn(),
      createDocument: jest.fn(),
      updateDocument: jest.fn(),
      deleteDocument: jest.fn(),
      getDocumentById: jest.fn(),
      listDocumentsForOrganisation: jest.fn(),
      listPublicDocumentsForOrganisation: jest.fn(),
      upsertPolicyDocument: jest.fn(),
    },
  };
});

jest.mock("../../../src/middlewares/upload", () => ({
  generatePresignedUrl: jest.fn(),
  getURLForKey: jest.fn((key: string) => `https://cdn.example/${key}`),
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// The controller only ever awaits these service calls, so a permissive async
// signature keeps the mocks usable without restating each service DTO here.
type AsyncMock = jest.MockedFunction<(...args: any[]) => Promise<any>>;

const mockedService = OrganizationDocumentService as unknown as {
  getFixedLegalDocument: jest.MockedFunction<
    (type: LegalDocumentType) => LegalDocumentResponse
  >;
  acknowledgeDocument: jest.MockedFunction<
    (input: AcknowledgeOrgDocumentInput) => Promise<void>
  >;
  getAcknowledgementStatus: jest.MockedFunction<
    (input: {
      organisationId: string;
      documentId: string;
      userId: string;
    }) => Promise<DocumentAcknowledgementStatus>
  >;
  createDocument: AsyncMock;
  updateDocument: AsyncMock;
  deleteDocument: AsyncMock;
  getDocumentById: AsyncMock;
  listDocumentsForOrganisation: AsyncMock;
  listPublicDocumentsForOrganisation: AsyncMock;
  upsertPolicyDocument: AsyncMock;
};

const mockedGeneratePresignedUrl = generatePresignedUrl as unknown as AsyncMock;
const mockedLogger = logger as unknown as { error: jest.Mock };

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  res.send = jest.fn().mockReturnValue(res) as never;
  return res as Response;
};

const documentFixture = {
  _id: "doc-1",
  organisationId: "org-1",
  title: "Terms",
  category: "TERMS_AND_CONDITIONS" as const,
  visibility: "PUBLIC" as const,
  version: 1,
};

describe("OrganizationDocumentController acknowledgements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records a document acknowledgement for the authenticated mobile user", async () => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: {
        category: "TERMS_AND_CONDITIONS",
        version: 2,
      },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();
    mockedService.acknowledgeDocument.mockResolvedValueOnce(undefined);

    await OrganizationDocumentController.acknowledgeDocument(req, res);

    expect(mockedService.acknowledgeDocument).toHaveBeenCalledWith({
      organisationId: "org-1",
      documentId: "doc-1",
      userId: "user-1",
      category: "TERMS_AND_CONDITIONS",
      version: 2,
    });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it.each([
    ["an unknown category", { category: "FIRE_SAFETY", version: 1 }],
    [
      "a non-positive version",
      { category: "TERMS_AND_CONDITIONS", version: 0 },
    ],
    [
      "a fractional version",
      { category: "TERMS_AND_CONDITIONS", version: 1.5 },
    ],
    ["a missing version", { category: "TERMS_AND_CONDITIONS" }],
  ])("rejects %s with 400", async (_label, body) => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body,
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeDocument(req, res);

    expect(mockedService.acknowledgeDocument).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid request body" });
  });

  it("maps an acknowledgement service error to its status code", async () => {
    mockedService.acknowledgeDocument.mockRejectedValueOnce(
      new OrgDocumentServiceError("Document not found", 404),
    );
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: { category: "PRIVACY_POLICY", version: 1 },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Document not found" });
  });

  it("returns 500 when the acknowledgement fails unexpectedly", async () => {
    mockedService.acknowledgeDocument.mockRejectedValueOnce(new Error("boom"));
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: { category: "PRIVACY_POLICY", version: 1 },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("returns the acknowledgement status for the current document version", async () => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();
    mockedService.getAcknowledgementStatus.mockResolvedValueOnce({
      acknowledged: true,
      version: 3,
      acknowledgedAt: new Date("2026-06-01T10:00:00Z"),
    });

    await OrganizationDocumentController.acknowledgeStatus(req, res);

    expect(mockedService.getAcknowledgementStatus).toHaveBeenCalledWith({
      organisationId: "org-1",
      documentId: "doc-1",
      userId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        acknowledged: true,
        version: 3,
        acknowledgedAt: "2026-06-01T10:00:00.000Z",
      },
    });
  });

  it("omits acknowledgedAt when the document has never been acknowledged", async () => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();
    mockedService.getAcknowledgementStatus.mockResolvedValueOnce({
      acknowledged: false,
      version: 2,
    });

    await OrganizationDocumentController.acknowledgeStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({
      data: { acknowledged: false, version: 2 },
    });
  });

  it("returns 401 when the mobile session is missing", async () => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: {
        category: "TERMS_AND_CONDITIONS",
        version: 2,
      },
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unauthorized: User ID missing",
    });
  });

  it("returns 401 from the status endpoint when the mobile session is missing", async () => {
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeStatus(req, res);

    expect(mockedService.getAcknowledgementStatus).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("maps a status service error to its status code", async () => {
    mockedService.getAcknowledgementStatus.mockRejectedValueOnce(
      new OrgDocumentServiceError("Document not found", 404),
    );
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Document not found" });
  });

  it("returns 500 when the status lookup fails unexpectedly", async () => {
    mockedService.getAcknowledgementStatus.mockRejectedValueOnce(
      new Error("boom"),
    );
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      userId: "user-1",
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.acknowledgeStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.getLegalDocument", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the fixed terms pdf metadata", async () => {
    mockedService.getFixedLegalDocument.mockReturnValueOnce({
      pdfUrl: "https://cdn.example/legal/terms-v1.pdf",
      version: "v1",
      lastUpdated: "2026-03-01",
    });
    const req = { params: { type: "terms" } } as unknown as Request<{
      type: string;
    }>;
    const res = createResponse();

    await OrganizationDocumentController.getLegalDocument(req, res);

    expect(mockedService.getFixedLegalDocument).toHaveBeenCalledWith("terms");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: {
        pdfUrl: "https://cdn.example/legal/terms-v1.pdf",
        version: "v1",
        lastUpdated: "2026-03-01",
      },
    });
  });

  it("returns 400 for invalid legal document types", async () => {
    const req = { params: { type: "other" } } as unknown as Request<{
      type: string;
    }>;
    const res = createResponse();

    await OrganizationDocumentController.getLegalDocument(req, res);

    expect(mockedService.getFixedLegalDocument).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid legal document type",
    });
  });

  it("surfaces service errors from the shared org document error type", async () => {
    mockedService.getFixedLegalDocument.mockImplementationOnce(() => {
      throw new OrgDocumentServiceError("Document not found", 404);
    });
    const req = { params: { type: "privacy" } } as unknown as Request<{
      type: string;
    }>;
    const res = createResponse();

    await OrganizationDocumentController.getLegalDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Document not found" });
  });

  it("returns 500 when the legal document lookup fails unexpectedly", async () => {
    mockedService.getFixedLegalDocument.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const req = { params: { type: "terms" } } as unknown as Request<{
      type: string;
    }>;
    const res = createResponse();

    await OrganizationDocumentController.getLegalDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a document scoped to the organisation from the route", async () => {
    mockedService.createDocument.mockResolvedValueOnce(documentFixture);
    const req = {
      params: { orgId: "org-1" },
      body: { title: "Terms", category: "TERMS_AND_CONDITIONS" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.create(req as never, res);

    expect(mockedService.createDocument).toHaveBeenCalledWith({
      title: "Terms",
      category: "TERMS_AND_CONDITIONS",
      organisationId: "org-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ data: documentFixture });
  });

  it("maps a service error to its status code", async () => {
    mockedService.createDocument.mockRejectedValueOnce(
      new OrgDocumentServiceError("title is required", 400),
    );
    const req = {
      params: { orgId: "org-1" },
      body: { category: "GENERAL" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.create(req as never, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "title is required" });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.createDocument.mockRejectedValueOnce(new Error("db down"));
    const req = {
      params: { orgId: "org-1" },
      body: { title: "Terms", category: "GENERAL" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.create(req as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates the addressed document with the request body", async () => {
    mockedService.updateDocument.mockResolvedValueOnce({
      ...documentFixture,
      title: "Terms v2",
    });
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: { title: "Terms v2" },
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.update(req as never, res);

    expect(mockedService.updateDocument).toHaveBeenCalledWith("doc-1", {
      title: "Terms v2",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: { ...documentFixture, title: "Terms v2" },
    });
  });

  it("maps a service error to its status code", async () => {
    mockedService.updateDocument.mockRejectedValueOnce(
      new OrgDocumentServiceError("Document not found", 404),
    );
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: { title: "Terms v2" },
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.update(req as never, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Document not found" });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.updateDocument.mockRejectedValueOnce(new Error("db down"));
    const req = {
      params: { orgId: "org-1", documentId: "doc-1" },
      body: {},
    } as unknown as Request<{ orgId: string; documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.update(req as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.remove", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes the addressed document and answers 204", async () => {
    mockedService.deleteDocument.mockResolvedValueOnce(undefined);
    const req = {
      params: { documentId: "doc-1" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.remove(req, res);

    expect(mockedService.deleteDocument).toHaveBeenCalledWith("doc-1");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("maps a service error to its status code", async () => {
    mockedService.deleteDocument.mockRejectedValueOnce(
      new OrgDocumentServiceError("Document not found", 404),
    );
    const req = {
      params: { documentId: "doc-1" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Document not found" });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.deleteDocument.mockRejectedValueOnce(new Error("db down"));
    const req = {
      params: { documentId: "doc-1" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.remove(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.getById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the addressed document", async () => {
    mockedService.getDocumentById.mockResolvedValueOnce(documentFixture);
    const req = {
      params: { documentId: "doc-1" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.getById(req, res);

    expect(mockedService.getDocumentById).toHaveBeenCalledWith("doc-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: documentFixture });
  });

  it("maps a service error to its status code", async () => {
    mockedService.getDocumentById.mockRejectedValueOnce(
      new OrgDocumentServiceError("Invalid documentId", 400),
    );
    const req = {
      params: { documentId: "$ne" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid documentId" });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.getDocumentById.mockRejectedValueOnce(new Error("db down"));
    const req = {
      params: { documentId: "doc-1" },
    } as unknown as Request<{ documentId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.getById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.list", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([["INTERNAL"], ["PUBLIC"], ["ALL"]])(
    "forwards the %s visibility filter",
    async (visibility) => {
      mockedService.listDocumentsForOrganisation.mockResolvedValueOnce([]);
      const req = {
        params: { orgId: "org-1" },
        query: { category: "FIRE_SAFETY", visibility },
      } as unknown as Request<{ orgId: string }>;
      const res = createResponse();

      await OrganizationDocumentController.list(req as never, res);

      expect(mockedService.listDocumentsForOrganisation).toHaveBeenCalledWith({
        organisationId: "org-1",
        category: "FIRE_SAFETY",
        visibility,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: [] });
    },
  );

  it("drops a category and visibility the API does not define", async () => {
    mockedService.listDocumentsForOrganisation.mockResolvedValueOnce([
      documentFixture,
    ]);
    const req = {
      params: { orgId: "org-1" },
      query: { category: "PAYROLL", visibility: "SECRET" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.list(req as never, res);

    expect(mockedService.listDocumentsForOrganisation).toHaveBeenCalledWith({
      organisationId: "org-1",
      category: undefined,
      visibility: undefined,
    });
    expect(res.json).toHaveBeenCalledWith({ data: [documentFixture] });
  });

  it("drops repeated query parameters that arrive as arrays", async () => {
    mockedService.listDocumentsForOrganisation.mockResolvedValueOnce([]);
    const req = {
      params: { orgId: "org-1" },
      query: {
        category: ["GENERAL", "GENERAL"],
        visibility: ["PUBLIC", "PUBLIC"],
      },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.list(req as never, res);

    expect(mockedService.listDocumentsForOrganisation).toHaveBeenCalledWith({
      organisationId: "org-1",
      category: undefined,
      visibility: undefined,
    });
  });

  it("maps a service error to its status code", async () => {
    mockedService.listDocumentsForOrganisation.mockRejectedValueOnce(
      new OrgDocumentServiceError("organisationId is required", 400),
    );
    const req = {
      params: { orgId: "" },
      query: {},
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.list(req as never, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "organisationId is required",
    });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.listDocumentsForOrganisation.mockRejectedValueOnce(
      new Error("db down"),
    );
    const req = {
      params: { orgId: "org-1" },
      query: {},
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.list(req as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.listPublic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards the category and visibility filters when present", async () => {
    mockedService.listPublicDocumentsForOrganisation.mockResolvedValueOnce([
      documentFixture,
    ]);
    const req = {
      params: { orgId: "org-1" },
      query: { category: "PRIVACY_POLICY", visibility: "PUBLIC" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.listPublic(req as never, res);

    expect(
      mockedService.listPublicDocumentsForOrganisation,
    ).toHaveBeenCalledWith({
      organisationId: "org-1",
      category: "PRIVACY_POLICY",
      visibility: "PUBLIC",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: [documentFixture] });
  });

  it("omits filters that are absent or not plain strings", async () => {
    mockedService.listPublicDocumentsForOrganisation.mockResolvedValueOnce([]);
    const req = {
      params: { orgId: "org-1" },
      query: { visibility: ["PUBLIC", "PUBLIC"] },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.listPublic(req as never, res);

    expect(
      mockedService.listPublicDocumentsForOrganisation,
    ).toHaveBeenCalledWith({ organisationId: "org-1" });
  });

  it("maps a service error to its status code", async () => {
    mockedService.listPublicDocumentsForOrganisation.mockRejectedValueOnce(
      new OrgDocumentServiceError("organisationId is required", 400),
    );
    const req = {
      params: { orgId: "" },
      query: {},
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.listPublic(req as never, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "organisationId is required",
    });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.listPublicDocumentsForOrganisation.mockRejectedValueOnce(
      new Error("db down"),
    );
    const req = {
      params: { orgId: "org-1" },
      query: {},
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.listPublic(req as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.upsertPolicy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forces policy documents to be public regardless of the request body", async () => {
    mockedService.upsertPolicyDocument.mockResolvedValueOnce(documentFixture);
    const req = {
      params: { orgId: "org-1" },
      body: {
        title: "Terms",
        category: "TERMS_AND_CONDITIONS",
        visibility: "INTERNAL",
      },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.upsertPolicy(req as never, res);

    expect(mockedService.upsertPolicyDocument).toHaveBeenCalledWith({
      title: "Terms",
      category: "TERMS_AND_CONDITIONS",
      organisationId: "org-1",
      visibility: "PUBLIC",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: documentFixture });
  });

  it("maps a service error to its status code", async () => {
    mockedService.upsertPolicyDocument.mockRejectedValueOnce(
      new OrgDocumentServiceError(
        "upsertPolicyDocument is only for policy categories",
        400,
      ),
    );
    const req = {
      params: { orgId: "org-1" },
      body: { title: "Handbook", category: "GENERAL" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.upsertPolicy(req as never, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "upsertPolicyDocument is only for policy categories",
    });
  });

  it("returns 500 for unexpected failures", async () => {
    mockedService.upsertPolicyDocument.mockRejectedValueOnce(
      new Error("db down"),
    );
    const req = {
      params: { orgId: "org-1" },
      body: { title: "Terms", category: "TERMS_AND_CONDITIONS" },
    } as unknown as Request<{ orgId: string }>;
    const res = createResponse();

    await OrganizationDocumentController.upsertPolicy(req as never, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });
});

describe("OrganizationDocumentController.uploadFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ["the body is not an object", undefined],
    ["the body carries no mimeType", {}],
    ["the mimeType is not a string", { mimeType: ["application/pdf"] }],
    ["the mimeType is empty", { mimeType: "" }],
  ])("returns 400 when %s", async (_label, body) => {
    const req = {
      body,
      params: { orgId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationDocumentController.uploadFile(req, res);

    expect(mockedGeneratePresignedUrl).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "MIME type is required in the request body.",
    });
  });

  it("presigns an org-scoped upload from the route params", async () => {
    mockedGeneratePresignedUrl.mockResolvedValueOnce({
      url: "https://s3.example/put",
      key: "org/org-1/policy.pdf",
    });
    const req = {
      body: { mimeType: "application/pdf" },
      params: { orgId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationDocumentController.uploadFile(req, res);

    expect(mockedGeneratePresignedUrl).toHaveBeenCalledWith(
      "application/pdf",
      "org",
      "orgId=org-1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      uploadUrl: "https://s3.example/put",
      s3Key: "org/org-1/policy.pdf",
    });
  });

  it("falls back to a temp upload when the request carries no params", async () => {
    mockedGeneratePresignedUrl.mockResolvedValueOnce({
      url: "https://s3.example/tmp",
      key: "temp/policy.pdf",
    });
    const req = {
      body: { mimeType: "application/pdf" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationDocumentController.uploadFile(req, res);

    expect(mockedGeneratePresignedUrl).toHaveBeenCalledWith(
      "application/pdf",
      "temp",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      uploadUrl: "https://s3.example/tmp",
      s3Key: "temp/policy.pdf",
    });
  });

  it("logs and returns 500 when presigning fails", async () => {
    mockedGeneratePresignedUrl.mockRejectedValueOnce(new Error("s3 down"));
    const req = {
      body: { mimeType: "application/pdf" },
      params: { orgId: "org-1" },
    } as unknown as Request;
    const res = createResponse();

    await OrganizationDocumentController.uploadFile(req, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to generate logo upload URL",
      expect.any(Error),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to generate logo upload URL.",
    });
  });
});
