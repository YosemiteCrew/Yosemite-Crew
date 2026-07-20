import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { OrganizationDocumentController } from "../../../src/controllers/web/organisation-document.controller";
import {
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
    },
  };
});

const mockedService = OrganizationDocumentService as unknown as {
  getFixedLegalDocument: jest.MockedFunction<
    (type: LegalDocumentType) => LegalDocumentResponse
  >;
};

const createResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res) as never;
  res.json = jest.fn().mockReturnValue(res) as never;
  return res as Response;
};

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
