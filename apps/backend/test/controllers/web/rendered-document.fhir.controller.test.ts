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
jest.mock("../../../src/services/rendered-document.service");
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
    expect(jsonMock).toHaveBeenCalledWith({
      id: "doc-1",
      organisationId: "org-1",
    });
  });

  it("returns a rendered document pdf by id", async () => {
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
