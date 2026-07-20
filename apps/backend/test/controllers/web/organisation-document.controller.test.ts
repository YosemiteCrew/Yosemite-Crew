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
    },
  };
});

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
};

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  res.send = jest.fn().mockReturnValue(res) as never;
  return res as Response;
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
});
