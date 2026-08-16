import { createHmac } from "node:crypto";

const updateContact = jest.fn();
const createContact = jest.fn();

jest.mock("aws-sdk/clients/sesv2.js", () =>
  jest.fn(() => ({ updateContact, createContact })),
);
import {
  buildMarketingUnsubscribeUrl,
  createMarketingUnsubscribeToken,
  InvalidMarketingUnsubscribeTokenError,
  MarketingUnsubscribeConfigError,
  readMarketingUnsubscribeToken,
  resetMarketingUnsubscribeClientForTests,
  unsubscribeMarketingEmail,
} from "../../src/services/marketing-unsubscribe.service";

describe("marketing-unsubscribe.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateContact.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    createContact.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    resetMarketingUnsubscribeClientForTests();
    process.env.AWS_SES_REGION = "us-east-1";
    process.env.MARKETING_UNSUBSCRIBE_SECRET = "test-secret";
    process.env.SES_MARKETING_CONTACT_LIST_NAME = "marketing";
    process.env.PUBLIC_API_URL = "https://api.example.com/";
  });

  it("builds and verifies a signed unsubscribe URL", () => {
    const url = buildMarketingUnsubscribeUrl(" Person@Example.com ");
    const token = new URL(url).searchParams.get("token");

    expect(url).toContain("/v1/email-preferences/unsubscribe");
    expect(readMarketingUnsubscribeToken(token!)).toBe("person@example.com");
  });

  it("rejects a tampered token", () => {
    const token = createMarketingUnsubscribeToken("person@example.com");
    expect(() => readMarketingUnsubscribeToken(`${token}x`)).toThrow(
      InvalidMarketingUnsubscribeTokenError,
    );
  });

  it("does not leak the recipient address into the unsubscribe URL", () => {
    const url = buildMarketingUnsubscribeUrl("person@example.com");

    // The token travels in a query string, so it reaches access logs, referrer headers
    // and proxies. Signing alone leaves the address readable to anyone who sees it.
    expect(url).not.toContain("person@example.com");
    expect(url).not.toContain(encodeURIComponent("person@example.com"));
    expect(url).not.toContain(
      Buffer.from("person@example.com", "utf8").toString("base64url"),
    );
    expect(url).not.toContain(
      Buffer.from("person@example.com", "utf8").toString("base64"),
    );
  });

  it("mints tokens that no longer carry a decodable payload", () => {
    const token = createMarketingUnsubscribeToken("person@example.com");
    const [version, iv, sealed] = token.split(".");

    expect(version).toBe("v2");
    expect(iv).toBeTruthy();
    expect(Buffer.from(sealed, "base64url").toString("utf8")).not.toContain(
      "person@example.com",
    );
  });

  it("gives a different token each time for the same address", () => {
    // A deterministic token is a stable identifier for the recipient across links.
    expect(createMarketingUnsubscribeToken("person@example.com")).not.toBe(
      createMarketingUnsubscribeToken("person@example.com"),
    );
  });

  it("still honours legacy signed tokens from already-sent mail", () => {
    const payload = Buffer.from("person@example.com", "utf8").toString(
      "base64url",
    );
    const signature = createHmac("sha256", "test-secret")
      .update(payload)
      .digest("base64url");

    expect(readMarketingUnsubscribeToken(`${payload}.${signature}`)).toBe(
      "person@example.com",
    );
  });

  it("rejects a legacy token whose signature does not match", () => {
    const payload = Buffer.from("person@example.com", "utf8").toString(
      "base64url",
    );

    expect(() =>
      readMarketingUnsubscribeToken(`${payload}.not-the-signature`),
    ).toThrow(InvalidMarketingUnsubscribeTokenError);
  });

  it("rejects a v2 token sealed under a different secret", () => {
    const token = createMarketingUnsubscribeToken("person@example.com");
    process.env.MARKETING_UNSUBSCRIBE_SECRET = "another-secret";

    expect(() => readMarketingUnsubscribeToken(token)).toThrow(
      InvalidMarketingUnsubscribeTokenError,
    );
  });

  it.each(["not-a-token", "payload.signature.extra"])(
    "rejects malformed unsubscribe token %s",
    (token) => {
      expect(() => readMarketingUnsubscribeToken(token)).toThrow(
        InvalidMarketingUnsubscribeTokenError,
      );
    },
  );

  it("rejects a signed token that does not contain an email", () => {
    const token = createMarketingUnsubscribeToken("not-an-email");
    expect(() => readMarketingUnsubscribeToken(token)).toThrow(
      InvalidMarketingUnsubscribeTokenError,
    );
  });

  it("requires the URL and signing configuration", () => {
    delete process.env.PUBLIC_API_URL;
    expect(() => buildMarketingUnsubscribeUrl("person@example.com")).toThrow(
      MarketingUnsubscribeConfigError,
    );

    process.env.PUBLIC_API_URL = "https://api.example.com";
    delete process.env.MARKETING_UNSUBSCRIBE_SECRET;
    expect(() => buildMarketingUnsubscribeUrl("person@example.com")).toThrow(
      MarketingUnsubscribeConfigError,
    );
  });

  it("updates an existing SES contact", async () => {
    const token = createMarketingUnsubscribeToken("person@example.com");

    await unsubscribeMarketingEmail(token);

    expect(updateContact).toHaveBeenCalledWith({
      ContactListName: "marketing",
      EmailAddress: "person@example.com",
      UnsubscribeAll: true,
    });
    expect(createContact).not.toHaveBeenCalled();
  });

  it("creates an unsubscribed SES contact when it does not exist", async () => {
    updateContact.mockReturnValue({
      promise: jest.fn().mockRejectedValue({ code: "NotFoundException" }),
    });
    const token = createMarketingUnsubscribeToken("person@example.com");

    await unsubscribeMarketingEmail(token);

    expect(createContact).toHaveBeenCalledWith({
      ContactListName: "marketing",
      EmailAddress: "person@example.com",
      UnsubscribeAll: true,
    });
  });

  it("retries the update when concurrent contact creation wins", async () => {
    const updatePromise = jest
      .fn()
      .mockRejectedValueOnce({ code: "NotFoundException" })
      .mockResolvedValueOnce({});
    updateContact.mockReturnValue({ promise: updatePromise });
    createContact.mockReturnValue({
      promise: jest.fn().mockRejectedValue({ code: "AlreadyExistsException" }),
    });
    const token = createMarketingUnsubscribeToken("person@example.com");

    await unsubscribeMarketingEmail(token);

    expect(updateContact).toHaveBeenCalledTimes(2);
    expect(createContact).toHaveBeenCalledTimes(1);
  });

  it("propagates SES update failures", async () => {
    updateContact.mockReturnValue({
      promise: jest.fn().mockRejectedValue({ code: "AccessDeniedException" }),
    });

    await expect(
      unsubscribeMarketingEmail(
        createMarketingUnsubscribeToken("person@example.com"),
      ),
    ).rejects.toEqual({ code: "AccessDeniedException" });
  });

  it("propagates SES contact creation failures", async () => {
    updateContact.mockReturnValue({
      promise: jest.fn().mockRejectedValue({ code: "NotFoundException" }),
    });
    createContact.mockReturnValue({
      promise: jest.fn().mockRejectedValue({ code: "AccessDeniedException" }),
    });

    await expect(
      unsubscribeMarketingEmail(
        createMarketingUnsubscribeToken("person@example.com"),
      ),
    ).rejects.toEqual({ code: "AccessDeniedException" });
  });

  it("requires an SES region and contact list", async () => {
    const token = createMarketingUnsubscribeToken("person@example.com");
    delete process.env.SES_MARKETING_CONTACT_LIST_NAME;
    await expect(unsubscribeMarketingEmail(token)).rejects.toThrow(
      MarketingUnsubscribeConfigError,
    );

    process.env.SES_MARKETING_CONTACT_LIST_NAME = "marketing";
    delete process.env.AWS_SES_REGION;
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    resetMarketingUnsubscribeClientForTests();
    await expect(unsubscribeMarketingEmail(token)).rejects.toThrow(
      MarketingUnsubscribeConfigError,
    );
  });

  it("falls back to the standard AWS region", async () => {
    delete process.env.AWS_SES_REGION;
    process.env.AWS_REGION = "eu-west-1";

    await unsubscribeMarketingEmail(
      createMarketingUnsubscribeToken("person@example.com"),
    );

    expect(updateContact).toHaveBeenCalledTimes(1);
  });
});
