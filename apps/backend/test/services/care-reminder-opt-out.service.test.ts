import {
  buildCareReminderUnsubscribeUrl,
  createCareReminderOptOutToken,
  CareReminderOptOutConfigError,
  InvalidCareReminderOptOutTokenError,
  isOptedOutOfCareReminders,
  normalizeOptOutEmail,
  readCareReminderOptOutToken,
  recordCareReminderOptOut,
  unsubscribeFromCareReminders,
} from "src/services/care-reminder-opt-out.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    careReminderOptOut: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const pm = prisma as unknown as {
  careReminderOptOut: { findFirst: jest.Mock; upsert: jest.Mock };
};

describe("care-reminder-opt-out.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MARKETING_UNSUBSCRIBE_SECRET = "test-secret";
    process.env.PUBLIC_API_URL = "https://api.example.com/";
    pm.careReminderOptOut.findFirst.mockResolvedValue(null);
    pm.careReminderOptOut.upsert.mockResolvedValue({});
  });

  describe("token", () => {
    it("round-trips organisation and normalised email through the URL", () => {
      const url = buildCareReminderUnsubscribeUrl({
        organisationId: "org-1",
        email: "  Person@Example.COM ",
      });
      const token = new URL(url).searchParams.get("token");

      expect(url).toContain("/v1/reminder-preferences/unsubscribe");
      expect(readCareReminderOptOutToken(token!)).toEqual({
        organisationId: "org-1",
        email: "person@example.com",
      });
    });

    it("does not leak the address into the URL", () => {
      const url = buildCareReminderUnsubscribeUrl({
        organisationId: "org-1",
        email: "person@example.com",
      });
      expect(url).not.toContain("person@example.com");
      expect(url).not.toContain("org-1");
    });

    it("rejects a tampered ciphertext", () => {
      const token = createCareReminderOptOutToken({
        organisationId: "org-1",
        email: "person@example.com",
      });
      const [version, iv, sealed] = token.split(".");
      // Flip a character inside the sealed payload rather than appending one:
      // base64url decoding silently drops a trailing incomplete group, so
      // `token + "x"` can decode to the identical bytes and prove nothing.
      const flipped =
        sealed.slice(0, 4) + (sealed[4] === "A" ? "B" : "A") + sealed.slice(5);
      expect(() =>
        readCareReminderOptOutToken([version, iv, flipped].join(".")),
      ).toThrow(InvalidCareReminderOptOutTokenError);
    });

    it("rejects a token sealed for a different practice's key material", () => {
      const token = createCareReminderOptOutToken({
        organisationId: "org-1",
        email: "person@example.com",
      });
      process.env.MARKETING_UNSUBSCRIBE_SECRET = "a-different-secret";
      expect(() => readCareReminderOptOutToken(token)).toThrow(
        InvalidCareReminderOptOutTokenError,
      );
    });

    it.each([
      ["wrong version", "v9.aaaa.bbbb"],
      ["too few parts", "v1.aaaa"],
      ["truncated payload that cannot hold a GCM tag", "v1.YWFhYQ.YWFh"],
    ])("rejects a malformed token (%s)", (_label, token) => {
      expect(() => readCareReminderOptOutToken(token)).toThrow(
        InvalidCareReminderOptOutTokenError,
      );
    });

    it("does not accept a marketing token (domain separation)", () => {
      // Same secret, different derivation info, so the marketing key must not open
      // a reminder token and vice versa.
      const { createMarketingUnsubscribeToken } = jest.requireActual<
        typeof import("src/services/marketing-unsubscribe.service")
      >("src/services/marketing-unsubscribe.service");
      const marketingToken =
        createMarketingUnsubscribeToken("person@example.com");
      expect(() => readCareReminderOptOutToken(marketingToken)).toThrow(
        InvalidCareReminderOptOutTokenError,
      );
    });

    it("surfaces a config error rather than calling it an invalid link", () => {
      delete process.env.MARKETING_UNSUBSCRIBE_SECRET;
      expect(() =>
        createCareReminderOptOutToken({
          organisationId: "org-1",
          email: "person@example.com",
        }),
      ).toThrow(CareReminderOptOutConfigError);
    });

    it("requires PUBLIC_API_URL to build a link", () => {
      delete process.env.PUBLIC_API_URL;
      expect(() =>
        buildCareReminderUnsubscribeUrl({
          organisationId: "org-1",
          email: "person@example.com",
        }),
      ).toThrow(CareReminderOptOutConfigError);
    });
  });

  describe("isOptedOutOfCareReminders", () => {
    it("is false when no row matches", async () => {
      await expect(
        isOptedOutOfCareReminders({
          organisationId: "org-1",
          email: "person@example.com",
          channel: "EMAIL",
        }),
      ).resolves.toBe(false);
    });

    it("matches the requested channel or an ALL row, scoped to the practice", async () => {
      pm.careReminderOptOut.findFirst.mockResolvedValue({ id: "row-1" });

      await expect(
        isOptedOutOfCareReminders({
          organisationId: "org-1",
          email: " Person@Example.com ",
          channel: "EMAIL",
        }),
      ).resolves.toBe(true);

      expect(pm.careReminderOptOut.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId: "org-1",
            email: "person@example.com",
            channel: { in: ["EMAIL", "ALL"] },
          },
        }),
      );
    });
  });

  describe("recordCareReminderOptOut", () => {
    it("upserts so a repeated click or a prefetching mail client cannot fail", async () => {
      await recordCareReminderOptOut({
        organisationId: "org-1",
        email: "Person@Example.com",
      });

      expect(pm.careReminderOptOut.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organisationId_email_channel: {
              organisationId: "org-1",
              email: "person@example.com",
              channel: "ALL",
            },
          },
          create: expect.objectContaining({
            organisationId: "org-1",
            email: "person@example.com",
            channel: "ALL",
            source: "unsubscribe-link",
          }),
        }),
      );
    });
  });

  it("unsubscribeFromCareReminders records ALL for the token's practice", async () => {
    const token = createCareReminderOptOutToken({
      organisationId: "org-7",
      email: "person@example.com",
    });

    await expect(unsubscribeFromCareReminders(token)).resolves.toEqual({
      organisationId: "org-7",
      email: "person@example.com",
    });

    expect(pm.careReminderOptOut.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organisationId: "org-7",
          channel: "ALL",
        }),
      }),
    );
  });

  it("normalizeOptOutEmail trims and lower-cases", () => {
    expect(normalizeOptOutEmail("  MiXeD@Case.COM  ")).toBe("mixed@case.com");
  });
});
