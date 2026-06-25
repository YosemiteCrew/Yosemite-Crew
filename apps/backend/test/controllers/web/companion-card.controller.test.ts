import { Request, Response } from "express";
import { CompanionCardController } from "../../../src/controllers/web/companion-card.controller";
import { CompanionCardService } from "../../../src/services/companion-card.service";

jest.mock("../../../src/services/companion-card.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/companion-card.service",
  ) as any;
  return {
    ...actual,
    CompanionCardService: {
      issueShareToken: jest.fn(),
      listTokens: jest.fn(),
      revokeToken: jest.fn(),
      resolveByRawToken: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { CompanionCardServiceError } = jest.requireActual(
  "../../../src/services/companion-card.service",
) as any;

const service = jest.mocked(CompanionCardService);

describe("CompanionCardController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const orgParams = { organisationId: "org-1", patientId: "pat-1" };
  const authed = (extra: Record<string, unknown> = {}) =>
    ({
      params: orgParams,
      userPermissions: ["companions:view:any"],
      userId: "user-1",
      ...extra,
    }) as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock } as Partial<Response>;
  });

  describe("shared controller behaviour", () => {
    it("500s when permissions were not loaded", async () => {
      await CompanionCardController.issueShareToken(
        {
          params: orgParams,
          body: { audience: "PUBLIC" },
        } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("maps a service error to its status code", async () => {
      service.issueShareToken.mockRejectedValue(
        new CompanionCardServiceError("Companion not found.", 404),
      );
      await CompanionCardController.issueShareToken(
        authed({ body: { audience: "PUBLIC" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("500s on an unexpected error", async () => {
      service.issueShareToken.mockRejectedValue(new Error("boom"));
      await CompanionCardController.issueShareToken(
        authed({ body: { audience: "PUBLIC" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("issueShareToken", () => {
    it("issues a token and returns 201", async () => {
      service.issueShareToken.mockResolvedValue({
        token: "raw",
        qrPayload: "/card/raw",
        share: { id: "s1" },
      } as never);
      await CompanionCardController.issueShareToken(
        authed({ body: { audience: "PUBLIC", showOwnerPhone: true } }),
        res as Response,
      );
      expect(service.issueShareToken).toHaveBeenCalledWith(
        expect.objectContaining({
          audience: "PUBLIC",
          showOwnerPhone: true,
          actor: { type: "PMS_USER", id: "user-1" },
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("400s on an invalid audience", async () => {
      await CompanionCardController.issueShareToken(
        authed({ body: { audience: "STAFF" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("400s on invalid params", async () => {
      await CompanionCardController.issueShareToken(
        authed({
          params: { organisationId: "", patientId: "" },
          body: { audience: "PUBLIC" },
        }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("listTokens", () => {
    it("returns the token list", async () => {
      service.listTokens.mockResolvedValue([{ id: "s1" }] as never);
      await CompanionCardController.listTokens(authed(), res as Response);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ tokens: [{ id: "s1" }] });
    });
  });

  describe("revokeToken", () => {
    it("revokes and returns the share", async () => {
      service.revokeToken.mockResolvedValue({
        id: "s1",
        revokedAt: "x",
      } as never);
      await CompanionCardController.revokeToken(
        authed({ params: { organisationId: "org-1", tokenId: "tok-1" } }),
        res as Response,
      );
      expect(service.revokeToken).toHaveBeenCalledWith("tok-1", "org-1", {
        type: "PMS_USER",
        id: "user-1",
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("400s on invalid revoke params", async () => {
      await CompanionCardController.revokeToken(
        authed({ params: { organisationId: "", tokenId: "" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("getByPublicToken", () => {
    it("returns the public card on success", async () => {
      service.resolveByRawToken.mockResolvedValue({
        audience: "PUBLIC",
      } as never);
      await CompanionCardController.getByPublicToken(
        { params: { token: "raw" } } as unknown as Request,
        res as Response,
      );
      expect(service.resolveByRawToken).toHaveBeenCalledWith("raw");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("maps a service not-found to its status code", async () => {
      service.resolveByRawToken.mockRejectedValue(
        new CompanionCardServiceError("Card not found.", 404),
      );
      await CompanionCardController.getByPublicToken(
        { params: { token: "raw" } } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it("falls back to a uniform 404 on an unexpected error", async () => {
      service.resolveByRawToken.mockRejectedValue(new Error("db down"));
      await CompanionCardController.getByPublicToken(
        { params: {} } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: "Card not found." });
    });
  });
});
