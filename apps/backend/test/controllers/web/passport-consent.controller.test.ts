import { Request, Response } from "express";
import { PassportConsentController } from "../../../src/controllers/web/passport-consent.controller";
import { PassportConsentService } from "../../../src/services/passport-consent.service";

jest.mock("../../../src/services/passport-consent.service", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = jest.requireActual(
    "../../../src/services/passport-consent.service",
  ) as any;
  return {
    ...actual,
    PassportConsentService: {
      requestConsent: jest.fn(),
      grantConsent: jest.fn(),
      revokeConsent: jest.fn(),
      listConsents: jest.fn(),
    },
  };
});
jest.mock("../../../src/utils/logger");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PassportConsentError } = jest.requireActual(
  "../../../src/services/passport-consent.service",
) as any;
const service = jest.mocked(PassportConsentService);

describe("PassportConsentController", () => {
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const companionParams = { organisationId: "org-1", patientId: "pat-1" };
  const consentParams = { organisationId: "org-1", consentId: "con-1" };
  const orgParams = { organisationId: "org-1" };
  const authed = (
    params: Record<string, string>,
    extra: Record<string, unknown> = {},
  ) =>
    ({
      params,
      userPermissions: ["passport:edit:any"],
      userId: "user-1",
      ...extra,
    }) as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock } as Partial<Response>;
  });

  describe("requestConsent", () => {
    const body = { recipientOrganisationId: "org-2", purpose: "referral" };

    it("201s and passes the actor", async () => {
      service.requestConsent.mockResolvedValue({ id: "con-1" } as never);
      await PassportConsentController.requestConsent(
        authed(companionParams, { body }),
        res as Response,
      );
      expect(service.requestConsent).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: "pat-1",
          recipientOrganisationId: "org-2",
          actor: { type: "PMS_USER", id: "user-1" },
        }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("500s without permissions, 400s bad params + body, maps a service error", async () => {
      await PassportConsentController.requestConsent(
        { params: companionParams, body } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PassportConsentController.requestConsent(
        authed({ organisationId: "", patientId: "" }, { body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      await PassportConsentController.requestConsent(
        authed(companionParams, { body: {} }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      service.requestConsent.mockRejectedValue(
        new PassportConsentError("bad", 400),
      );
      await PassportConsentController.requestConsent(
        authed(companionParams, { body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("grantConsent", () => {
    const body = { method: "EMAIL" };

    it("200s granting", async () => {
      service.grantConsent.mockResolvedValue({ status: "GRANTED" } as never);
      await PassportConsentController.grantConsent(
        authed(consentParams, { body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("500s without permissions, 400s bad params + body", async () => {
      await PassportConsentController.grantConsent(
        { params: consentParams, body } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PassportConsentController.grantConsent(
        authed({ organisationId: "", consentId: "" }, { body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      await PassportConsentController.grantConsent(
        authed(consentParams, { body: { method: "NOPE" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      service.grantConsent.mockRejectedValue(new Error("boom"));
      await PassportConsentController.grantConsent(
        authed(consentParams, { body }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("revokeConsent", () => {
    it("200s revoking, 500s without permissions, 500s on an unexpected error", async () => {
      service.revokeConsent.mockResolvedValue({ status: "REVOKED" } as never);
      await PassportConsentController.revokeConsent(
        authed(consentParams, { body: { reason: "x" } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      await PassportConsentController.revokeConsent(
        { params: consentParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PassportConsentController.revokeConsent(
        authed({ organisationId: "", consentId: "" }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      await PassportConsentController.revokeConsent(
        authed(consentParams, { body: { reason: 123 } }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      service.revokeConsent.mockRejectedValue(new Error("boom"));
      await PassportConsentController.revokeConsent(
        authed(consentParams),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  describe("listConsents", () => {
    it("200s, 500s without permissions, 400s bad params", async () => {
      service.listConsents.mockResolvedValue({
        outgoing: [],
        incoming: [],
      } as never);
      await PassportConsentController.listConsents(
        authed(orgParams),
        res as Response,
      );
      expect(jsonMock).toHaveBeenCalledWith({ outgoing: [], incoming: [] });
      await PassportConsentController.listConsents(
        { params: orgParams } as unknown as Request,
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
      await PassportConsentController.listConsents(
        authed({ organisationId: "" }),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(400);
      service.listConsents.mockRejectedValue(new Error("boom"));
      await PassportConsentController.listConsents(
        authed(orgParams),
        res as Response,
      );
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
