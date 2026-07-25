import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { FormSigningController } from "../../../src/controllers/web/formSigning.contorller";
import { FormSigningService } from "../../../src/services/formSigning.service";
import { AuthUserMobileService } from "../../../src/services/authUserMobile.service";

jest.mock("../../../src/services/formSigning.service", () => ({
  FormSigningService: {
    startSigning: jest.fn(),
    getSignedDocument: jest.fn(),
  },
}));

jest.mock("../../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

const mockedSigning = jest.mocked(FormSigningService);
const mockedAuthUser = jest.mocked(AuthUserMobileService);

describe("FormSigningController", () => {
  type TestRequest = Partial<Request> & {
    userId?: string;
    organisationId?: string;
  };
  let req: TestRequest;
  let res: Response;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { params: { submissionId: "sub-1" } };
    res = { status: statusMock, json: jsonMock } as unknown as Response;
    jest.clearAllMocks();
  });

  describe("startSigning (PMS)", () => {
    it("uses the token userId + authorized org, returns the result", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      mockedSigning.startSigning.mockResolvedValue({ ok: true } as never);

      await FormSigningController.startSigning(req as Request, res);

      expect(mockedSigning.startSigning).toHaveBeenCalledWith({
        submissionId: "sub-1",
        initiatedBy: "auth-user-id",
        organisationId: "org-1",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ ok: true });
    });

    it("rejects with 401 when the token userId is missing", async () => {
      req.organisationId = "org-1";

      await FormSigningController.startSigning(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockedSigning.startSigning).not.toHaveBeenCalled();
    });

    it("rejects with 403 when no authorized organisation is bound", async () => {
      req.userId = "auth-user-id";

      await FormSigningController.startSigning(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockedSigning.startSigning).not.toHaveBeenCalled();
    });

    it("returns 400 with the error message when the service throws", async () => {
      req.userId = "auth-user-id";
      req.organisationId = "org-1";
      mockedSigning.startSigning.mockRejectedValue(new Error("boom"));

      await FormSigningController.startSigning(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "boom" });
    });
  });

  describe("startSigningMobile", () => {
    it("resolves the parent from the token user and starts signing", async () => {
      req.userId = "auth-user-id";
      mockedAuthUser.getByProviderUserId.mockResolvedValue({
        parentId: { toString: () => "parent-1" },
      } as never);
      mockedSigning.startSigning.mockResolvedValue({ ok: true } as never);

      await FormSigningController.startSigningMobile(req as Request, res);

      expect(mockedSigning.startSigning).toHaveBeenCalledWith({
        isParent: true,
        submissionId: "sub-1",
        initiatedBy: "parent-1",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("rejects with 401 when the token userId is missing", async () => {
      await FormSigningController.startSigningMobile(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockedAuthUser.getByProviderUserId).not.toHaveBeenCalled();
    });

    it("returns 400 when the auth user cannot be resolved from the token", async () => {
      req.userId = "auth-user-id";
      mockedAuthUser.getByProviderUserId.mockResolvedValue(null as never);

      await FormSigningController.startSigningMobile(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(mockedSigning.startSigning).not.toHaveBeenCalled();
    });
  });

  describe("getSignedDocument", () => {
    it("returns the signed document for the submission", async () => {
      mockedSigning.getSignedDocument.mockResolvedValue({ url: "x" } as never);

      await FormSigningController.getSignedDocument(req as Request, res);

      expect(mockedSigning.getSignedDocument).toHaveBeenCalledWith({
        submissionId: "sub-1",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ url: "x" });
    });

    it("returns 400 when retrieval fails", async () => {
      mockedSigning.getSignedDocument.mockRejectedValue(new Error("nope"));

      await FormSigningController.getSignedDocument(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: "nope" });
    });
  });
});
