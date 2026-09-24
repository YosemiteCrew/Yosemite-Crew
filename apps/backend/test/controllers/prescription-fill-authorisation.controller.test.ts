import type { Request, Response } from "express";
import { PrescriptionFillAuthorisationController } from "../../src/controllers/web/prescription-fill-authorisation.controller";
import {
  PrescriptionFillAuthorisationService,
  PrescriptionFillAuthorisationServiceError,
} from "../../src/services/prescription-fill-authorisation.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/services/prescription-fill-authorisation.service", () => {
  const actual = jest.requireActual(
    "../../src/services/prescription-fill-authorisation.service",
  );
  return {
    ...actual,
    PrescriptionFillAuthorisationService: {
      authoriseFills: jest.fn(),
      revokeAuthorization: jest.fn(),
      getFillEligibility: jest.fn(),
      reserveFill: jest.fn(),
      recordFulfilment: jest.fn(),
      cancelReservation: jest.fn(),
    },
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const service = PrescriptionFillAuthorisationService as unknown as Record<
  string,
  jest.Mock
>;
const mockedLogger = logger as unknown as { error: jest.Mock };

const ORG = "org-A";
const ITEM = "item-1";

const makeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    params: { organisationId: ORG, itemId: ITEM },
    body: {},
    userId: "clinician-1",
    userPermissions: ["prescription:edit:any"],
    ...overrides,
  }) as unknown as Request;

const AUTHORISE_BODY = {
  validUntil: "2026-06-01T00:00:00.000Z",
  maxAdditionalFills: 2,
  perFillQuantity: "10",
  perFillQuantityUnit: "tablet",
};

beforeEach(() => {
  jest.clearAllMocks();
  service.authoriseFills.mockResolvedValue({ id: "auth-1", version: 1 });
  service.revokeAuthorization.mockResolvedValue({ id: "auth-1" });
  service.getFillEligibility.mockResolvedValue({ eligible: true });
  service.reserveFill.mockResolvedValue({ id: "res-1" });
  service.recordFulfilment.mockResolvedValue({ id: "res-1" });
  service.cancelReservation.mockResolvedValue({ id: "res-1" });
});

describe("authorise", () => {
  it("returns 201 and hands the service a parsed date", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: AUTHORISE_BODY }),
      res,
    );

    expect(service.authoriseFills).toHaveBeenCalledWith({
      organisationId: ORG,
      itemId: ITEM,
      validUntil: new Date(AUTHORISE_BODY.validUntil),
      maxAdditionalFills: 2,
      perFillQuantity: "10",
      perFillQuantityUnit: "tablet",
      authorisedBy: "clinician-1",
      canEditAny: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "auth-1", version: 1 });
  });

  /*
   * The router admits `prescription:edit:own` holders, so this flag is the
   * only thing that stops one of them authorising on another clinician's
   * prescription. It has to come from the loaded permissions and nowhere else.
   */
  it.each([
    [["prescription:edit:own"], false],
    [["prescription:edit:any", "prescription:edit:own"], true],
    [undefined, false],
  ])(
    "derives canEditAny=%s from the caller's permissions",
    async (permissions, expected) => {
      await PrescriptionFillAuthorisationController.authorise(
        makeReq({ body: AUTHORISE_BODY, userPermissions: permissions }),
        makeRes(),
      );

      expect(service.authoriseFills).toHaveBeenCalledWith(
        expect.objectContaining({ canEditAny: expected }),
      );
    },
  );

  it("ignores a body that claims org-wide authority", async () => {
    await PrescriptionFillAuthorisationController.authorise(
      makeReq({
        body: { ...AUTHORISE_BODY, canEditAny: true },
        userPermissions: ["prescription:edit:own"],
      }),
      makeRes(),
    );

    expect(service.authoriseFills).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAny: false }),
    );
  });

  it("rejects a quantity that is not a decimal string", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: { ...AUTHORISE_BODY, perFillQuantity: "1.2.3" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.authoriseFills).not.toHaveBeenCalled();
  });

  it("rejects a quantity sent as a JSON number", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: { ...AUTHORISE_BODY, perFillQuantity: 0.1 } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.authoriseFills).not.toHaveBeenCalled();
  });

  it("rejects a validUntil without an offset", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: { ...AUTHORISE_BODY, validUntil: "2026-06-01" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.authoriseFills).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller with 401", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: AUTHORISE_BODY, userId: "   " }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.authoriseFills).not.toHaveBeenCalled();
  });

  it("passes a service refusal through with its own status", async () => {
    service.authoriseFills.mockRejectedValueOnce(
      new PrescriptionFillAuthorisationServiceError(
        "Prescription was authored by another user",
        403,
      ),
    );
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: AUTHORISE_BODY }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Prescription was authored by another user",
    });
  });

  /*
   * An unexpected error can name a record the caller is not entitled to know
   * exists, so the assertion is that its message does NOT reach the response.
   */
  it("logs an unexpected error and answers 500 without echoing it", async () => {
    service.authoriseFills.mockRejectedValueOnce(
      new Error("relation prescription_fill_authorization does not exist"),
    );
    const res = makeRes();

    await PrescriptionFillAuthorisationController.authorise(
      makeReq({ body: AUTHORISE_BODY }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to authorise prescription refills.",
    });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("revoke", () => {
  const params = { organisationId: ORG, authorizationId: "auth-1" };

  it("returns 200 and forwards the reason", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.revoke(
      makeReq({ params, body: { reason: "Dose changed" } }),
      res,
    );

    expect(service.revokeAuthorization).toHaveBeenCalledWith({
      organisationId: ORG,
      authorizationId: "auth-1",
      revokedBy: "clinician-1",
      canEditAny: true,
      reason: "Dose changed",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("accepts a request with no body at all", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.revoke(
      makeReq({ params, body: undefined }),
      res,
    );

    expect(service.revokeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a blank authorisationId in the path", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.revoke(
      makeReq({ params: { organisationId: ORG, authorizationId: "  " } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.revokeAuthorization).not.toHaveBeenCalled();
  });

  it("derives canEditAny for an own-only caller", async () => {
    await PrescriptionFillAuthorisationController.revoke(
      makeReq({ params, userPermissions: ["prescription:edit:own"] }),
      makeRes(),
    );

    expect(service.revokeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ canEditAny: false }),
    );
  });

  it("refuses an unauthenticated caller with 401", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.revoke(
      makeReq({ params, userId: undefined }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.revokeAuthorization).not.toHaveBeenCalled();
  });
});

describe("eligibility", () => {
  it("returns 200 with the service's answer", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.eligibility(makeReq(), res);

    expect(service.getFillEligibility).toHaveBeenCalledWith({
      organisationId: ORG,
      itemId: ITEM,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ eligible: true });
  });

  it("rejects a blank itemId in the path", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.eligibility(
      makeReq({ params: { organisationId: ORG, itemId: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.getFillEligibility).not.toHaveBeenCalled();
  });

  it("answers 500 when the read fails unexpectedly", async () => {
    service.getFillEligibility.mockRejectedValueOnce(new Error("boom"));
    const res = makeRes();

    await PrescriptionFillAuthorisationController.eligibility(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to read prescription refill eligibility.",
    });
  });
});

describe("reserve", () => {
  it("returns 201 and forwards the optional fields", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.reserve(
      makeReq({
        body: {
          idempotencyKey: "key-1",
          expectedVersion: 2,
          dispenseRequestId: "dr-1",
        },
      }),
      res,
    );

    expect(service.reserveFill).toHaveBeenCalledWith({
      organisationId: ORG,
      itemId: ITEM,
      idempotencyKey: "key-1",
      expectedVersion: 2,
      dispenseRequestId: "dr-1",
      reservedBy: "clinician-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("requires an idempotency key", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.reserve(
      makeReq({ body: { expectedVersion: 2 } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.reserveFill).not.toHaveBeenCalled();
  });

  it("rejects a fractional expectedVersion", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.reserve(
      makeReq({ body: { idempotencyKey: "key-1", expectedVersion: 1.5 } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.reserveFill).not.toHaveBeenCalled();
  });

  it("passes a stale-version conflict through as 409", async () => {
    service.reserveFill.mockRejectedValueOnce(
      new PrescriptionFillAuthorisationServiceError(
        "Fill authorisation has been superseded",
        409,
      ),
    );
    const res = makeRes();

    await PrescriptionFillAuthorisationController.reserve(
      makeReq({ body: { idempotencyKey: "key-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("refuses an unauthenticated caller with 401", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.reserve(
      makeReq({ body: { idempotencyKey: "key-1" }, userId: undefined }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.reserveFill).not.toHaveBeenCalled();
  });
});

describe("fulfil", () => {
  const params = { organisationId: ORG, reservationId: "res-1" };

  it("returns 200 and keeps the quantity a string", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.fulfil(
      makeReq({ params, body: { quantity: "2.5" } }),
      res,
    );

    expect(service.recordFulfilment).toHaveBeenCalledWith({
      organisationId: ORG,
      reservationId: "res-1",
      quantity: "2.5",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a missing quantity", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.fulfil(
      makeReq({ params, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.recordFulfilment).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller with 401", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.fulfil(
      makeReq({ params, body: { quantity: "1" }, userId: undefined }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.recordFulfilment).not.toHaveBeenCalled();
  });

  it("answers 500 when the write fails unexpectedly", async () => {
    service.recordFulfilment.mockRejectedValueOnce(new Error("boom"));
    const res = makeRes();

    await PrescriptionFillAuthorisationController.fulfil(
      makeReq({ params, body: { quantity: "1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to record a prescription refill fulfilment.",
    });
  });
});

describe("cancel", () => {
  const params = { organisationId: ORG, reservationId: "res-1" };

  it("returns 200 and forwards the reason", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.cancel(
      makeReq({ params, body: { reason: "Owner declined" } }),
      res,
    );

    expect(service.cancelReservation).toHaveBeenCalledWith({
      organisationId: ORG,
      reservationId: "res-1",
      reason: "Owner declined",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("accepts a request with no body at all", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.cancel(
      makeReq({ params, body: undefined }),
      res,
    );

    expect(service.cancelReservation).toHaveBeenCalledWith(
      expect.objectContaining({ reason: undefined }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects a blank reservationId in the path", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.cancel(
      makeReq({ params: { organisationId: ORG, reservationId: " " } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.cancelReservation).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller with 401", async () => {
    const res = makeRes();

    await PrescriptionFillAuthorisationController.cancel(
      makeReq({ params, userId: undefined }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(service.cancelReservation).not.toHaveBeenCalled();
  });
});
