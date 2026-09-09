import { ConsentController } from "../../src/controllers/app/consent.controller";
import { SuperadminConsentService } from "../../src/services/superadmin-consent.service";

jest.mock("../../src/services/superadmin-consent.service", () => ({
  SuperadminConsentService: {
    forwardConsentDecision: jest.fn(),
  },
}));

const mockedForward =
  SuperadminConsentService.forwardConsentDecision as jest.Mock;

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe("ConsentController.reportWebDecision", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a body without a consentId", async () => {
    const res = createResponse();

    await ConsentController.reportWebDecision(
      { body: { granted: true } } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "A consentId and a boolean decision are required",
    });
    expect(mockedForward).not.toHaveBeenCalled();
  });

  it("rejects a body with a non-boolean decision", async () => {
    const res = createResponse();

    await ConsentController.reportWebDecision(
      { body: { consentId: "c-1", granted: "true" } } as any,
      res as any,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedForward).not.toHaveBeenCalled();
  });

  it("forwards a valid decision without identity enrichment", async () => {
    const res = createResponse();

    await ConsentController.reportWebDecision(
      {
        body: { consentId: "c-1", granted: false },
        headers: {},
      } as any,
      res as any,
    );

    expect(mockedForward).toHaveBeenCalledWith(
      {
        consentId: "c-1",
        source: "web",
        decisions: [{ category: "analytics", granted: false }],
        userId: undefined,
        email: undefined,
      },
      undefined,
    );
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("enriches from a verified session when one is present", async () => {
    const res = createResponse();

    await ConsentController.reportWebDecision(
      {
        body: { consentId: "c-2", granted: true },
        headers: { "user-agent": "Mozilla/5.0" },
        userId: "user-9",
        email: "ada@example.com",
      } as any,
      res as any,
    );

    expect(mockedForward).toHaveBeenCalledWith(
      expect.objectContaining({
        consentId: "c-2",
        userId: "user-9",
        email: "ada@example.com",
      }),
      "Mozilla/5.0",
    );
  });

  it("does not wait for the forward to settle before responding", async () => {
    let resolveForward: (() => void) | undefined;
    mockedForward.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveForward = resolve;
        }),
    );
    const res = createResponse();

    await ConsentController.reportWebDecision(
      { body: { consentId: "c-3", granted: true }, headers: {} } as any,
      res as any,
    );

    // The response has been sent although the forward is still pending.
    expect(res.status).toHaveBeenCalledWith(202);
    expect(mockedForward).toHaveBeenCalledTimes(1);
    resolveForward?.();
  });
});
