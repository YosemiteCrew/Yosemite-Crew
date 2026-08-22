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

import { SuperadminContactService } from "../../src/services/superadmin-contact.service";
import type { CreateWebContactRequestInput } from "../../src/services/contact-us.service";

const makeResponse = (ok = true, status = 200) =>
  ({ ok, status }) as unknown as Response;

const PAYLOAD = {
  type: "GENERAL_ENQUIRY",
  source: "WEB",
  message: "my dog ate the invoice",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+441234567890",
} as unknown as CreateWebContactRequestInput;

describe("SuperadminContactService.forwardWebContact", () => {
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
    process.env.SUPERADMIN_CONTACT_INTAKE_URL =
      "https://panel.example.com/api/contact";
    process.env.SUPERADMIN_CONTACT_INTAKE_KEY = "shared-secret";
  };

  it("does nothing when the URL is unset", async () => {
    process.env.SUPERADMIN_CONTACT_INTAKE_KEY = "shared-secret";
    delete process.env.SUPERADMIN_CONTACT_INTAKE_URL;
    await SuperadminContactService.forwardWebContact(PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("does nothing when the key is unset", async () => {
    process.env.SUPERADMIN_CONTACT_INTAKE_URL =
      "https://panel.example.com/api/contact";
    delete process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
    await SuperadminContactService.forwardWebContact(PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("posts the payload verbatim with the shared key and a timeout", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse());
    await SuperadminContactService.forwardWebContact(PAYLOAD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://panel.example.com/api/contact");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-contact-key": "shared-secret",
    });
    // Verbatim: the panel maps fullName/type/phone itself, so nothing is
    // reshaped here and a field added to the form flows through untouched.
    expect(JSON.parse(init.body as string)).toEqual(PAYLOAD);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("warns but resolves when the panel rejects the forward", async () => {
    configure();
    fetchMock.mockResolvedValue(makeResponse(false, 401));
    await expect(
      SuperadminContactService.forwardWebContact(PAYLOAD),
    ).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith(
      "SuperAdmin contact intake rejected the forward",
      { status: 401 },
    );
  });

  it("logs but resolves when the request itself fails", async () => {
    configure();
    const error = new Error("ECONNREFUSED");
    fetchMock.mockRejectedValue(error);
    await expect(
      SuperadminContactService.forwardWebContact(PAYLOAD),
    ).resolves.toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith(
      "Failed to forward contact submission to SuperAdmin",
      { error },
    );
  });
});
