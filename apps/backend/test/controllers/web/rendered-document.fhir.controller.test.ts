import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { prisma } from "../../../src/config/prisma";
import { isReadFromPostgres } from "../../../src/config/read-switch";
import { RenderedDocumentFhirController } from "../../../src/controllers/web/rendered-document.fhir.controller";
import {
  getPersistedRenderedDocument,
  getPersistedRenderedDocumentPdf,
  rerenderPersistedClinicalRenderedDocumentPdf,
  signPersistedRenderedDocument,
} from "../../../src/services/rendered-document.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock("../../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));
jest.mock("../../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));
// `toRenderedDocumentReadDto` is the projection under test on the read paths, so
// it keeps its real implementation while the I/O-bound exports are stubbed.
jest.mock("../../../src/services/rendered-document.service", () => ({
  ...(jest.requireActual(
    "../../../src/services/rendered-document.service",
  ) as object),
  getPersistedRenderedDocument: jest.fn(),
  getPersistedRenderedDocumentPdf: jest.fn(),
  rerenderPersistedClinicalRenderedDocumentPdf: jest.fn(),
  signPersistedRenderedDocument: jest.fn(),
}));
jest.mock("../../../src/utils/logger");

const mockedUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockedIsReadFromPostgres = jest.mocked(isReadFromPostgres);
const mockedGetPersistedRenderedDocument = jest.mocked(
  getPersistedRenderedDocument,
);
const mockedGetPersistedRenderedDocumentPdf = jest.mocked(
  getPersistedRenderedDocumentPdf,
);
const mockedRerenderPersistedClinicalRenderedDocumentPdf = jest.mocked(
  rerenderPersistedClinicalRenderedDocumentPdf,
);
const mockedSignPersistedRenderedDocument = jest.mocked(
  signPersistedRenderedDocument,
);
const mockedLogger = jest.mocked(logger);

describe("RenderedDocumentFhirController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    mockedIsReadFromPostgres.mockReturnValue(true);
    (mockedUserFindUnique as any).mockResolvedValue({
      email: "user-1@example.com",
      firstName: "User",
      lastName: "One",
    });

    jsonMock = jest.fn();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

    req = {
      params: {
        organisationId: "org-1",
        renderedDocumentId: "doc-1",
      },
      body: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
    } as unknown as Response;

    jest.clearAllMocks();
  });

  it("returns a rendered document by id", async () => {
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "SOAP_NOTE",
      signing: null,
    } as never);

    await RenderedDocumentFhirController.getRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(mockedGetPersistedRenderedDocument).toHaveBeenCalledWith(
      "doc-1",
      "org-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doc-1",
        organisationId: "org-1",
        signing: null,
      }),
    );
  });

  it("never returns the signing bearer url on the read path", async () => {
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "SOAP_NOTE",
      signing: {
        required: true,
        provider: "DOCUMENSO",
        status: "IN_PROGRESS",
        documentId: "42",
        signerName: "User One",
        signerEmail: "user-1@example.com",
        signingUrl: "https://documenso.example/sign/secret-token",
      },
    } as never);

    await RenderedDocumentFhirController.getRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
    const payload = jsonMock.mock.calls[0][0] as { signing: unknown };
    expect(payload.signing).toEqual({
      required: true,
      provider: "DOCUMENSO",
      status: "IN_PROGRESS",
      signerName: "User One",
    });
    expect(JSON.stringify(payload)).not.toContain("secret-token");
    expect(JSON.stringify(payload)).not.toContain("signingUrl");
  });

  it("hides invoice-kind rendered documents from clinical-only permissions", async () => {
    (req as { userPermissions?: string[] }).userPermissions = [
      "forms:view:any",
    ];
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "INVOICE",
      signing: null,
    } as never);

    await RenderedDocumentFhirController.getRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Forbidden – insufficient permissions",
    });
  });

  it("serves an invoice-kind rendered document to a billing viewer", async () => {
    (req as { userPermissions?: string[] }).userPermissions = [
      "forms:view:any",
      "billing:view:any",
    ];
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "INVOICE",
      signing: null,
    } as never);

    await RenderedDocumentFhirController.getRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("refuses to stream an invoice-kind pdf without a billing permission", async () => {
    (req as { userPermissions?: string[] }).userPermissions = [
      "prescription:view:any",
    ];
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "INVOICE",
      signing: null,
    } as never);

    await RenderedDocumentFhirController.getRenderedDocumentPdf(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(mockedGetPersistedRenderedDocumentPdf).not.toHaveBeenCalled();
  });

  it("returns a rendered document pdf by id", async () => {
    mockedGetPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      organisationId: "org-1",
      kind: "SOAP_NOTE",
      signing: null,
    } as never);
    mockedGetPersistedRenderedDocumentPdf.mockResolvedValueOnce({
      pdf: Buffer.from("%PDF-FAKE"),
      filename: "soap-note-doc-1.pdf",
      contentType: "application/pdf",
    } as never);

    await RenderedDocumentFhirController.getRenderedDocumentPdf(
      req as Request,
      res as Response,
    );

    expect(mockedGetPersistedRenderedDocumentPdf).toHaveBeenCalledWith(
      "doc-1",
      "org-1",
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf",
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="soap-note-doc-1.pdf"',
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(sendMock).toHaveBeenCalledWith(Buffer.from("%PDF-FAKE"));
  });

  it("rerenders a clinical rendered document pdf by id", async () => {
    mockedRerenderPersistedClinicalRenderedDocumentPdf.mockResolvedValueOnce({
      pdf: Buffer.from("%PDF-RERENDERED"),
      filename: "soap-note-doc-1.pdf",
      contentType: "application/pdf",
    } as never);

    await RenderedDocumentFhirController.rerenderRenderedDocumentPdf(
      req as Request,
      res as Response,
    );

    expect(
      mockedRerenderPersistedClinicalRenderedDocumentPdf,
    ).toHaveBeenCalledWith("doc-1", "org-1");
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf",
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="soap-note-doc-1.pdf"',
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(sendMock).toHaveBeenCalledWith(Buffer.from("%PDF-RERENDERED"));
  });

  it("signs a rendered document using the authenticated user", async () => {
    (req as { userId?: string }).userId = "user-1";
    req.body = { signatureText: "Signed" };
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "doc-1",
      signing: {
        documentId: "42",
        signingUrl: "https://documenso.example/sign/abc",
      },
    } as never);

    await RenderedDocumentFhirController.signRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith({
      renderedDocumentId: "doc-1",
      organisationId: "org-1",
      signerId: "user-1",
      signerType: "PMS_USER",
      signerEmail: "user-1@example.com",
      signerName: "User One",
      signatureText: "Signed",
      signedAt: undefined,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      documentId: "42",
      signingUrl: "https://documenso.example/sign/abc",
    });
  });

  it("rejects signing when the user is missing", async () => {
    await RenderedDocumentFhirController.signRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "User not authenticated.",
    });
    expect(mockedSignPersistedRenderedDocument).not.toHaveBeenCalled();
  });

  it("maps unexpected errors to a 500 response", async () => {
    mockedGetPersistedRenderedDocument.mockRejectedValueOnce(new Error("boom"));

    await RenderedDocumentFhirController.getRenderedDocument(
      req as Request,
      res as Response,
    );

    expect(mockedLogger.error).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Internal Server Error",
    });
  });
});
