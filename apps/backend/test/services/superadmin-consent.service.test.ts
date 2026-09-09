const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: errorMock,
    info: jest.fn(),
    warn: warnMock,
    debug: jest.fn(),
  },
}));

import {
  SuperadminConsentService,
  type SuperadminConsentPayload,
} from "../../src/services/superadmin-consent.service";

const makeResponse = (ok = true, status = 200) =>
  ({ ok, status }) as unknown as Response;

const PAYLOAD: SuperadminConsentPayload = {
  consentId: "probe-consent-b6724",
  source: "web",
  decisions: [{ category: "analytics", granted: true }],
};

describe("SuperadminConsentService.forwardConsentDecision", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  const configure = () => {
    process.env.SUPERADMIN_CONSENT_INTAKE_URL =
      "https://panel.example.com/api/consent";
    process.env.SUPERADMIN_CONSENT_INTAKE_KEY = "shared-secret";
  };

  it("does nothing when the URL is unset", async () => {
    process.env.SUPERADMIN_CONSENT_INTAKE_KEY = "shared-secret";
    delete process.env.SUPERADMIN_CONSENT_INTAKE_URL;
    await SuperadminConsentService.forwardConsentDecision(PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("does nothing when the key is unset", async () => {
    process.env.SUPERADMIN_CONSENT_INTAKE_URL =
      "https://panel.example.com/api/consent";
    delete process.env.SUPERADMIN_CONSENT_INTAKE_KEY;
    await SuperadminConsentService.forwardConsentDecision(PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("posts the payload with the shared key and a timeout", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse());
    await SuperadminConsentService.forwardConsentDecision(PAYLOAD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://panel.example.com/api/consent");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-consent-key": "shared-secret",
    });
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("carries the browser user-agent through to the panel", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse());
    await SuperadminConsentService.forwardConsentDecision(
      PAYLOAD,
      "Mozilla/5.0 (test)",
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ "user-agent": "Mozilla/5.0 (test)" });
  });

  it("does not set a user-agent header when none was supplied", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse());
    await SuperadminConsentService.forwardConsentDecision(PAYLOAD);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty("user-agent");
  });

  it("warns but resolves when the panel rejects the forward", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse(false, 401));
    await expect(
      SuperadminConsentService.forwardConsentDecision(PAYLOAD),
    ).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith(
      "SuperAdmin consent intake rejected the forward",
      { status: 401 },
    );
  });

  it("logs but resolves when the request itself fails", async () => {
    configure();
    const error = new Error("ECONNREFUSED");
    fetchMock.mockRejectedValue(error);
    await expect(
      SuperadminConsentService.forwardConsentDecision(PAYLOAD),
    ).resolves.toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith(
      "Failed to forward consent decision to SuperAdmin",
      { error },
    );
  });
});
