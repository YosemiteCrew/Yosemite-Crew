import { Prisma } from "@prisma/client";
import {
  BookingPageService,
  BookingPageServiceError,
  ensureBookingSlug,
  isValidBookingSlug,
  resolveBookingPageUrl,
  slugifyOrganisationName,
} from "src/services/booking-page.service";
import { prisma } from "src/config/prisma";

const txReservationCreate = jest.fn();
const txOrganizationUpdateMany = jest.fn();

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    organization: { findUnique: jest.fn() },
    publicBookingSettings: { findUnique: jest.fn(), upsert: jest.fn() },
    productItem: { findMany: jest.fn() },
  },
}));

const pm = prisma as unknown as {
  $transaction: jest.Mock;
  organization: { findUnique: jest.Mock };
  publicBookingSettings: { findUnique: jest.Mock; upsert: jest.Mock };
  productItem: { findMany: jest.Mock };
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0",
  });

/**
 * Run the interactive transaction against a stub client, so a test can make the
 * reservation insert or the guarded update fail the way Postgres would.
 */
const runTransaction = async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    bookingSlugReservation: { create: txReservationCreate },
    organization: { updateMany: txOrganizationUpdateMany },
  });

/** The slug each `$transaction` attempt tried to claim, in order. */
const attemptedSlugs = () =>
  txReservationCreate.mock.calls.map((call) => call[0].data.slug as string);

describe("booking-page.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PUBLIC_BOOKING_BASE_URL;
    pm.$transaction.mockImplementation(runTransaction);
    txReservationCreate.mockResolvedValue({});
    txOrganizationUpdateMany.mockResolvedValue({ count: 1 });
    pm.publicBookingSettings.findUnique.mockResolvedValue(null);
    pm.publicBookingSettings.upsert.mockResolvedValue({});
    pm.productItem.findMany.mockResolvedValue([]);
  });

  describe("slugifyOrganisationName", () => {
    it("strips diacritics rather than shredding the name around them", () => {
      expect(slugifyOrganisationName("Tierärzte Grünwald")).toBe(
        "tierarzte-grunwald",
      );
    });

    it("collapses punctuation and trims stray hyphens", () => {
      expect(slugifyOrganisationName("  Park & Vets — Clinic!  ")).toBe(
        "park-vets-clinic",
      );
    });

    it("returns an empty string when nothing survives", () => {
      expect(slugifyOrganisationName("!!! ??? ***")).toBe("");
    });

    it("never emits a trailing hyphen after truncation", () => {
      const name = `${"a".repeat(62)} clinic`;
      const slug = slugifyOrganisationName(name);
      expect(slug.length).toBeLessThanOrEqual(63);
      expect(slug.endsWith("-")).toBe(false);
    });
  });

  describe("isValidBookingSlug", () => {
    it.each(["park-veterinary", "a1", "x".repeat(63)])("accepts %s", (slug) => {
      expect(isValidBookingSlug(slug)).toBe(true);
    });

    it.each([
      ["", "empty"],
      ["-leading", "leading hyphen"],
      ["trailing-", "trailing hyphen"],
      ["Upper", "uppercase"],
      ["has space", "space"],
      ["x".repeat(64), "too long"],
      ["12345", "all digits"],
      ["3f6b1a2c-1111-2222-3333-444455556666", "uuid shaped"],
      ["xn--mnchen", "punycode prefix"],
      ["admin", "reserved"],
      ["api", "reserved routing segment"],
    ])("rejects %s (%s)", (slug) => {
      expect(isValidBookingSlug(slug)).toBe(false);
    });
  });

  describe("resolveBookingPageUrl", () => {
    it("returns null when the practice has not opted in", () => {
      process.env.PUBLIC_BOOKING_BASE_URL = "https://app.example.com";
      expect(resolveBookingPageUrl("park-vets", false)).toBeNull();
    });

    it("returns null when no origin is configured for this environment", () => {
      expect(resolveBookingPageUrl("park-vets", true)).toBeNull();
    });

    it("returns null when there is no slug", () => {
      process.env.PUBLIC_BOOKING_BASE_URL = "https://app.example.com";
      expect(resolveBookingPageUrl(null, true)).toBeNull();
    });

    it("builds the address once published and configured", () => {
      process.env.PUBLIC_BOOKING_BASE_URL = "https://app.example.com/";
      expect(resolveBookingPageUrl("park-vets", true)).toBe(
        "https://app.example.com/book/park-vets",
      );
    });

    it("ignores a non-absolute origin rather than emitting a relative link", () => {
      process.env.PUBLIC_BOOKING_BASE_URL = "app.example.com";
      expect(resolveBookingPageUrl("park-vets", true)).toBeNull();
    });
  });

  describe("ensureBookingSlug", () => {
    it("keeps the slug a practice already holds", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Park Veterinary",
        bookingSlug: "park-veterinary",
      });

      await expect(ensureBookingSlug("org-1")).resolves.toBe("park-veterinary");
      expect(pm.$transaction).not.toHaveBeenCalled();
    });

    it("claims the readable slug on first use", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Park Veterinary",
        bookingSlug: null,
      });

      await expect(ensureBookingSlug("org-1")).resolves.toBe("park-veterinary");
      expect(attemptedSlugs()).toEqual(["park-veterinary"]);
    });

    it("suffixes the second practice of the same name instead of failing", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-2",
        name: "Park Vets",
        bookingSlug: null,
      });
      txReservationCreate
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValueOnce({});

      await expect(ensureBookingSlug("org-2")).resolves.toBe("park-vets-2");
      expect(attemptedSlugs()).toEqual(["park-vets", "park-vets-2"]);
    });

    it("still allocates for a practice whose name is a reserved word", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-3",
        name: "Support",
        bookingSlug: null,
      });

      await expect(ensureBookingSlug("org-3")).resolves.toBe("support-2");
    });

    it("allocates for a practice whose name slugifies to nothing", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-4",
        name: "!!!",
        bookingSlug: null,
      });

      await expect(ensureBookingSlug("org-4")).resolves.toBe("clinic-2");
    });

    it("falls back to a random suffix once the readable candidates are taken", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-5",
        name: "Park Vets",
        bookingSlug: null,
      });
      // base + -2..-9 is nine candidates; reject all of them.
      for (let i = 0; i < 9; i += 1) {
        txReservationCreate.mockRejectedValueOnce(uniqueViolation());
      }
      txReservationCreate.mockResolvedValueOnce({});

      const slug = await ensureBookingSlug("org-5");
      expect(slug).toMatch(/^park-vets-[0-9a-f]{8}$/);
    });

    it("falls back to a generic random slug when the name slugifies to nothing", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-8",
        name: "!!!",
        bookingSlug: null,
      });
      // clinic-2..clinic-9 is eight candidates; reject all of them.
      for (let i = 0; i < 8; i += 1) {
        txReservationCreate.mockRejectedValueOnce(uniqueViolation());
      }
      txReservationCreate.mockResolvedValueOnce({});

      const slug = await ensureBookingSlug("org-8");
      expect(slug).toMatch(/^clinic-[0-9a-f]{8}$/);
    });

    it("yields to a concurrent request that allocated this organisation's slug first", async () => {
      pm.organization.findUnique
        .mockResolvedValueOnce({
          id: "org-9",
          name: "Park Vets",
          bookingSlug: null,
        })
        // The read-back after the guarded update refused the write.
        .mockResolvedValueOnce({ bookingSlug: "park-vets" });
      txOrganizationUpdateMany.mockResolvedValue({ count: 0 });

      await expect(ensureBookingSlug("org-9")).resolves.toBe("park-vets");
      // One attempt, then it defers - it must not walk on to `park-vets-2` and
      // strand the slug the winner just took.
      expect(attemptedSlugs()).toEqual(["park-vets"]);
    });

    it("reports a retryable failure if the concurrent winner left no slug behind", async () => {
      pm.organization.findUnique
        .mockResolvedValueOnce({
          id: "org-10",
          name: "Park Vets",
          bookingSlug: null,
        })
        .mockResolvedValueOnce({ bookingSlug: null });
      txOrganizationUpdateMany.mockResolvedValue({ count: 0 });

      await expect(ensureBookingSlug("org-10")).rejects.toMatchObject({
        status: 503,
      });
    });

    it("gives up with a retryable status rather than looping forever", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-6",
        name: "Park Vets",
        bookingSlug: null,
      });
      txReservationCreate.mockRejectedValue(uniqueViolation());

      await expect(ensureBookingSlug("org-6")).rejects.toMatchObject({
        status: 503,
      });
    });

    it("propagates a non-uniqueness database failure", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-7",
        name: "Park Vets",
        bookingSlug: null,
      });
      txReservationCreate.mockRejectedValue(new Error("connection lost"));

      await expect(ensureBookingSlug("org-7")).rejects.toThrow(
        "connection lost",
      );
    });

    it("404s for an organisation that does not exist", async () => {
      pm.organization.findUnique.mockResolvedValue(null);

      await expect(ensureBookingSlug("nope")).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe("identifier narrowing", () => {
    it.each([
      ["an object", { not: "" }],
      ["an array", ["org-1"]],
      ["a number", 7],
      ["null", null],
      ["an empty string", "   "],
      ["a string carrying a Prisma operator", "org$ne"],
    ])("refuses %s as an organisation id", async (_label, value) => {
      await expect(
        BookingPageService.getConfig(value as unknown as string),
      ).rejects.toMatchObject({ status: 400 });
      expect(pm.organization.findUnique).not.toHaveBeenCalled();
    });

    it("refuses a non-scalar service id before it reaches the `in` filter", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Park Vets",
        bookingSlug: "park-vets",
        publicBookingEnabled: false,
      });

      await expect(
        BookingPageService.saveConfig("org-1", {
          serviceIds: [{ not: "" }] as unknown as string[],
          bookingWindowDays: 28,
          bufferMinutes: 10,
          autoConfirm: false,
        }),
      ).rejects.toMatchObject({ status: 400 });
      expect(pm.productItem.findMany).not.toHaveBeenCalled();
    });
  });

  describe("getConfig", () => {
    it("returns defaults for a practice that never opened the wizard", async () => {
      pm.organization.findUnique.mockResolvedValue({
        bookingSlug: null,
        publicBookingEnabled: false,
      });

      await expect(BookingPageService.getConfig("org-1")).resolves.toEqual({
        organisationId: "org-1",
        slug: null,
        publicBookingEnabled: false,
        publicUrl: null,
        serviceIds: [],
        bookingWindowDays: 28,
        bufferMinutes: 10,
        autoConfirm: false,
        welcomeMessage: null,
        replyToEmail: null,
      });
    });

    it("never returns a URL while the practice is unpublished", async () => {
      process.env.PUBLIC_BOOKING_BASE_URL = "https://app.example.com";
      pm.organization.findUnique.mockResolvedValue({
        bookingSlug: "park-vets",
        publicBookingEnabled: false,
      });

      const config = await BookingPageService.getConfig("org-1");
      expect(config.slug).toBe("park-vets");
      expect(config.publicUrl).toBeNull();
    });

    it("returns the stored settings when they exist", async () => {
      pm.organization.findUnique.mockResolvedValue({
        bookingSlug: "park-vets",
        publicBookingEnabled: false,
      });
      pm.publicBookingSettings.findUnique.mockResolvedValue({
        serviceIds: ["svc-1"],
        bookingWindowDays: 56,
        bufferMinutes: 30,
        autoConfirm: true,
        welcomeMessage: "Hello",
        replyToEmail: "front@example.com",
      });

      const config = await BookingPageService.getConfig("org-1");
      expect(config).toMatchObject({
        serviceIds: ["svc-1"],
        bookingWindowDays: 56,
        bufferMinutes: 30,
        autoConfirm: true,
        welcomeMessage: "Hello",
        replyToEmail: "front@example.com",
      });
    });

    it("404s for an organisation that does not exist", async () => {
      pm.organization.findUnique.mockResolvedValue(null);

      await expect(BookingPageService.getConfig("nope")).rejects.toBeInstanceOf(
        BookingPageServiceError,
      );
    });
  });

  describe("saveConfig", () => {
    const input = {
      serviceIds: ["svc-1"],
      bookingWindowDays: 28,
      bufferMinutes: 10,
      autoConfirm: false,
      welcomeMessage: "  Book a visit.  ",
      replyToEmail: "  Front@Example.COM ",
    };

    beforeEach(() => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Park Vets",
        bookingSlug: "park-vets",
        publicBookingEnabled: false,
      });
    });

    it("rejects a service that does not belong to the caller's organisation", async () => {
      pm.productItem.findMany.mockResolvedValue([]);

      await expect(
        BookingPageService.saveConfig("org-1", input),
      ).rejects.toMatchObject({ status: 400 });
      expect(pm.publicBookingSettings.upsert).not.toHaveBeenCalled();
    });

    it("scopes the ownership check to the caller's own organisation", async () => {
      pm.productItem.findMany.mockResolvedValue([{ id: "svc-1" }]);

      await BookingPageService.saveConfig("org-1", input);

      expect(pm.productItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org-1",
            isActive: true,
            bookable: { isNot: null },
          }),
        }),
      );
    });

    it("trims the welcome message and normalises the reply-to address", async () => {
      pm.productItem.findMany.mockResolvedValue([{ id: "svc-1" }]);

      await BookingPageService.saveConfig("org-1", input);

      expect(pm.publicBookingSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            welcomeMessage: "Book a visit.",
            replyToEmail: "front@example.com",
          }),
        }),
      );
    });

    it("stores blank optional text as null rather than an empty string", async () => {
      pm.productItem.findMany.mockResolvedValue([{ id: "svc-1" }]);

      await BookingPageService.saveConfig("org-1", {
        ...input,
        welcomeMessage: "   ",
        replyToEmail: null,
      });

      expect(pm.publicBookingSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            welcomeMessage: null,
            replyToEmail: null,
          }),
        }),
      );
    });

    it("deduplicates the selected services", async () => {
      pm.productItem.findMany.mockResolvedValue([{ id: "svc-1" }]);

      await BookingPageService.saveConfig("org-1", {
        ...input,
        serviceIds: ["svc-1", "svc-1"],
      });

      expect(pm.publicBookingSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ serviceIds: ["svc-1"] }),
        }),
      );
    });

    it("skips the ownership query entirely when nothing is selected", async () => {
      await BookingPageService.saveConfig("org-1", {
        ...input,
        serviceIds: [],
      });

      expect(pm.productItem.findMany).not.toHaveBeenCalled();
      expect(pm.publicBookingSettings.upsert).toHaveBeenCalled();
    });

    it("allocates a slug for a practice saving for the first time", async () => {
      pm.organization.findUnique.mockResolvedValue({
        id: "org-1",
        name: "Park Vets",
        bookingSlug: null,
        publicBookingEnabled: false,
      });
      pm.productItem.findMany.mockResolvedValue([{ id: "svc-1" }]);

      await BookingPageService.saveConfig("org-1", input);

      expect(attemptedSlugs()).toEqual(["park-vets"]);
    });
  });
});
