import { createHash } from "node:crypto";
import {
  PublicBookingError,
  PublicBookingRequestService,
  PublicBookingService,
  resolveSlug,
} from "src/services/public-booking.service";
import { prisma } from "src/config/prisma";
import { CatalogService } from "src/services/catalog.service";
import { sendEmail } from "src/utils/email";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: { findUnique: jest.fn(), update: jest.fn() },
    bookingSlugReservation: { findUnique: jest.fn() },
    productItem: { findMany: jest.fn(), count: jest.fn() },
    publicBookingRequest: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("src/services/catalog.service", () => ({
  CatalogService: { getBookableSlotsService: jest.fn() },
}));

jest.mock("src/utils/email", () => ({ sendEmail: jest.fn() }));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const pm = prisma as unknown as {
  organization: { findUnique: jest.Mock; update: jest.Mock };
  bookingSlugReservation: { findUnique: jest.Mock };
  productItem: { findMany: jest.Mock; count: jest.Mock };
  publicBookingRequest: {
    count: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
};

const slotsMock = CatalogService.getBookableSlotsService as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

const SERVICE_ID = "3f6b1a2c-1111-4222-8333-444455556666";

const publishedOrg = (over: Record<string, unknown> = {}) => ({
  id: "org-1",
  name: "Park Veterinary",
  imageUrl: "https://cdn.example.com/logo.png",
  publicBookingEnabled: true,
  address: { city: "Berlin", country: "DE" },
  bookingSettings: {
    serviceIds: [SERVICE_ID],
    bookingWindowDays: 28,
    bufferMinutes: 10,
    autoConfirm: false,
    welcomeMessage: "Book a visit.",
    replyToEmail: "front@example.com",
  },
  ...over,
});

const bookableProduct = () => ({
  id: SERVICE_ID,
  name: "Wellness consultation",
  description: "Nose to tail.",
  bookable: { durationMinutes: 30 },
});

/** A date inside every practice's default 28-day window. */
const tomorrow = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

describe("public-booking.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUBLIC_BOOKING_BASE_URL = "https://app.example.com";
    pm.productItem.findMany.mockResolvedValue([bookableProduct()]);
    pm.publicBookingRequest.count.mockResolvedValue(0);
    pm.publicBookingRequest.create.mockResolvedValue({});
    sendEmailMock.mockResolvedValue({});
    slotsMock.mockResolvedValue({
      date: tomorrow(),
      windows: [
        {
          startTime: "09:00",
          endTime: "09:30",
          vetIds: ["staff-1", "staff-2"],
        },
      ],
    });
  });

  describe("slug resolution", () => {
    it("resolves a published practice", async () => {
      pm.organization.findUnique.mockResolvedValue(publishedOrg());
      const resolved = await resolveSlug("park-veterinary");
      expect(resolved).toMatchObject({ kind: "current" });
    });

    it("hides an unpublished practice behind the same 404 as one that does not exist", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({ publicBookingEnabled: false }),
      );
      const unpublished = await resolveSlug("park-veterinary").catch((e) => e);

      pm.organization.findUnique.mockResolvedValue(null);
      pm.bookingSlugReservation.findUnique.mockResolvedValue(null);
      const missing = await resolveSlug("nobody-owns-this").catch((e) => e);

      expect(unpublished).toBeInstanceOf(PublicBookingError);
      expect(missing).toBeInstanceOf(PublicBookingError);
      // Byte-identical, so walking slugs cannot map which practices use the
      // product before they open their page.
      expect(unpublished.status).toBe(missing.status);
      expect(unpublished.message).toBe(missing.message);
    });

    it("points a retired slug at the current one instead of 404ing a printed address", async () => {
      pm.organization.findUnique.mockResolvedValue(null);
      pm.bookingSlugReservation.findUnique.mockResolvedValue({
        organization: {
          bookingSlug: "park-veterinary",
          publicBookingEnabled: true,
        },
      });

      await expect(resolveSlug("old-park-vets")).resolves.toEqual({
        kind: "retired",
        slug: "park-veterinary",
      });
    });

    it("does not follow a retired slug into an unpublished practice", async () => {
      pm.organization.findUnique.mockResolvedValue(null);
      pm.bookingSlugReservation.findUnique.mockResolvedValue({
        organization: {
          bookingSlug: "park-veterinary",
          publicBookingEnabled: false,
        },
      });

      await expect(resolveSlug("old-park-vets")).rejects.toMatchObject({
        status: 404,
      });
    });

    it.each([
      ["an object", { not: "" }],
      ["a number", 7],
      ["a Prisma operator", "park$ne"],
    ])("refuses %s as a slug", async (_label, value) => {
      await expect(
        resolveSlug(value as unknown as string),
      ).rejects.toMatchObject({
        status: 400,
      });
      expect(pm.organization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("getPractice", () => {
    it("exposes only the public projection", async () => {
      pm.organization.findUnique.mockResolvedValue(publishedOrg());

      const practice =
        await PublicBookingService.getPractice("park-veterinary");

      expect(practice).toEqual({
        slug: "park-veterinary",
        name: "Park Veterinary",
        logoUrl: "https://cdn.example.com/logo.png",
        welcomeMessage: "Book a visit.",
        city: "Berlin",
        country: "DE",
        bookingWindowDays: 28,
        requiresConfirmation: true,
        services: [
          {
            id: SERVICE_ID,
            name: "Wellness consultation",
            description: "Nose to tail.",
            durationMinutes: 30,
          },
        ],
      });
    });

    it("never selects price, internal code or speciality from the catalogue", async () => {
      pm.organization.findUnique.mockResolvedValue(publishedOrg());
      await PublicBookingService.getPractice("park-veterinary");

      const select = pm.productItem.findMany.mock.calls[0][0].select;
      expect(Object.keys(select).sort()).toEqual([
        "bookable",
        "description",
        "id",
        "name",
      ]);
      expect(select).not.toHaveProperty("code");
      expect(select).not.toHaveProperty("prices");
      expect(select).not.toHaveProperty("specialityId");
    });

    it("offers nothing when the practice deliberately saved an empty selection", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({
          bookingSettings: {
            serviceIds: [],
            bookingWindowDays: 28,
            bufferMinutes: 10,
            autoConfirm: false,
            welcomeMessage: null,
            replyToEmail: null,
          },
        }),
      );

      const practice =
        await PublicBookingService.getPractice("park-veterinary");

      // A settings row with an empty list is a decision, not an absence, and it
      // must not be read as "offer everything". The catalogue is not even
      // queried.
      expect(practice.services).toEqual([]);
      expect(pm.productItem.findMany).not.toHaveBeenCalled();
    });

    it("offers everything bookable when the practice never narrowed the list", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({ bookingSettings: null }),
      );

      const practice =
        await PublicBookingService.getPractice("park-veterinary");

      expect(practice.services).toHaveLength(1);
      // No settings row, so no `id: { in: [...] }` filter at all.
      expect(pm.productItem.findMany.mock.calls[0][0].where).not.toHaveProperty(
        "id",
      );
    });

    it("tolerates a practice with no logo and no address", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({ imageUrl: null, address: null }),
      );

      await expect(
        PublicBookingService.getPractice("park-veterinary"),
      ).resolves.toMatchObject({ logoUrl: null, city: null, country: null });
    });

    it("uses the default window when the practice has no settings row", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({ bookingSettings: null }),
      );

      await expect(
        PublicBookingService.getPractice("park-veterinary"),
      ).resolves.toMatchObject({
        bookingWindowDays: 28,
        requiresConfirmation: true,
        welcomeMessage: null,
      });
    });

    it("reports zero duration rather than crashing if a product has no bookable row", async () => {
      pm.organization.findUnique.mockResolvedValue(publishedOrg());
      // The query filters these out, so this is a type-level possibility rather
      // than a reachable state; pinned so the fallback is a decision, not a
      // crash waiting for a schema change.
      pm.productItem.findMany.mockResolvedValue([
        { ...bookableProduct(), bookable: null },
      ]);

      const practice =
        await PublicBookingService.getPractice("park-veterinary");
      expect(practice.services[0].durationMinutes).toBe(0);
    });

    it("caps the advertised booking window", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({
          bookingSettings: {
            serviceIds: [SERVICE_ID],
            bookingWindowDays: 9999,
            bufferMinutes: 10,
            autoConfirm: true,
            welcomeMessage: null,
            replyToEmail: null,
          },
        }),
      );

      const practice =
        await PublicBookingService.getPractice("park-veterinary");
      expect(practice.bookingWindowDays).toBe(180);
      expect(practice.requiresConfirmation).toBe(false);
    });
  });

  describe("getSlots", () => {
    beforeEach(() =>
      pm.organization.findUnique.mockResolvedValue(publishedOrg()),
    );

    it("strips vetIds from every window", async () => {
      const result = await PublicBookingService.getSlots(
        "park-veterinary",
        SERVICE_ID,
        tomorrow(),
      );

      expect(result.windows).toEqual([
        { startTime: "09:00", endTime: "09:30" },
      ]);
      expect(JSON.stringify(result)).not.toContain("staff-1");
    });

    it("passes the practice's configured buffer to the slot generator", async () => {
      await PublicBookingService.getSlots(
        "park-veterinary",
        SERVICE_ID,
        tomorrow(),
      );

      // The 4th argument is the buffer, read from bookingSettings (10 in the
      // fixture). Without the wiring it defaults to 0 and public slots tile back
      // to back regardless of the "Buffer between visits" setting.
      expect(slotsMock).toHaveBeenCalledWith(
        SERVICE_ID,
        "org-1",
        expect.any(Date),
        10,
      );
    });

    it("passes a zero buffer when the setting is unset", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({
          bookingSettings: {
            serviceIds: [SERVICE_ID],
            bookingWindowDays: 28,
            bufferMinutes: 0,
            autoConfirm: false,
            welcomeMessage: null,
            replyToEmail: null,
          },
        }),
      );

      await PublicBookingService.getSlots(
        "park-veterinary",
        SERVICE_ID,
        tomorrow(),
      );

      expect(slotsMock).toHaveBeenCalledWith(
        SERVICE_ID,
        "org-1",
        expect.any(Date),
        0,
      );
    });

    it("refuses a date beyond the practice's booking window", async () => {
      const far = new Date();
      far.setUTCDate(far.getUTCDate() + 400);

      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          far.toISOString().slice(0, 10),
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(slotsMock).not.toHaveBeenCalled();
    });

    it("refuses a date in the past", async () => {
      const past = new Date();
      past.setUTCDate(past.getUTCDate() - 1);

      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          past.toISOString().slice(0, 10),
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("refuses a malformed date without touching the scheduler", async () => {
      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          "not-a-date",
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(slotsMock).not.toHaveBeenCalled();
    });

    it("404s a retired slug rather than serving slots under an old address", async () => {
      pm.organization.findUnique.mockResolvedValue(null);
      pm.bookingSlugReservation.findUnique.mockResolvedValue({
        organization: {
          bookingSlug: "park-veterinary",
          publicBookingEnabled: true,
        },
      });

      // The redirect is the caller's job. A slot response under the old name
      // would quietly answer for a practice the caller did not ask for.
      await expect(
        PublicBookingService.getSlots("old-park-vets", SERVICE_ID, tomorrow()),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("applies the default window when the practice has no settings row", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({ bookingSettings: null }),
      );
      const far = new Date();
      far.setUTCDate(far.getUTCDate() + 60);

      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          far.toISOString().slice(0, 10),
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("404s when the practice offers nothing publicly", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({
          bookingSettings: {
            serviceIds: [],
            bookingWindowDays: 28,
            bufferMinutes: 10,
            autoConfirm: false,
            welcomeMessage: null,
            replyToEmail: null,
          },
        }),
      );

      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          tomorrow(),
        ),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("404s for a service the practice does not offer publicly", async () => {
      pm.productItem.findMany.mockResolvedValue([]);

      await expect(
        PublicBookingService.getSlots(
          "park-veterinary",
          SERVICE_ID,
          tomorrow(),
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(slotsMock).not.toHaveBeenCalled();
    });
  });

  describe("submit", () => {
    const input = {
      serviceId: SERVICE_ID,
      date: tomorrow(),
      startTime: "09:00",
      ownerName: "  Sam Owner ",
      ownerEmail: "  Sam@Example.COM ",
      ownerPhone: " +49 30 1234 ",
      petName: " Rex ",
      petSpecies: " Dog ",
      concern: " Limping ",
    };

    beforeEach(() =>
      pm.organization.findUnique.mockResolvedValue(publishedOrg()),
    );

    it("stores a request, hashes the token, and emails the requester", async () => {
      await PublicBookingRequestService.submit("park-veterinary", input);

      const data = pm.publicBookingRequest.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        organizationId: "org-1",
        productItemId: SERVICE_ID,
        serviceName: "Wellness consultation",
        durationMinutes: 30,
        ownerName: "Sam Owner",
        ownerEmail: "sam@example.com",
        ownerPhone: "+49 30 1234",
        petName: "Rex",
        petSpecies: "Dog",
        concern: "Limping",
      });
      expect(data.confirmationTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.consentAcceptedAt).toBeInstanceOf(Date);
      expect(data.purgeAfter).toBeInstanceOf(Date);

      const [emailArgs] = sendEmailMock.mock.calls;
      expect(emailArgs[0].to).toBe("sam@example.com");
      // The link carries the raw token; the row carries only its hash.
      const link = emailArgs[0].textBody as string;
      const token = /token=([0-9a-f]{64})/.exec(link)?.[1];
      expect(token).toBeDefined();
      expect(
        createHash("sha256")
          .update(token as string)
          .digest("hex"),
      ).toBe(data.confirmationTokenHash);
    });

    it("stores blank optional fields as null rather than empty strings", async () => {
      await PublicBookingRequestService.submit("park-veterinary", {
        ...input,
        ownerPhone: "   ",
        concern: null,
      });

      expect(
        pm.publicBookingRequest.create.mock.calls[0][0].data,
      ).toMatchObject({
        ownerPhone: null,
        concern: null,
      });
    });

    it("refuses a time the practice does not actually offer", async () => {
      await expect(
        PublicBookingRequestService.submit("park-veterinary", {
          ...input,
          startTime: "03:00",
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(pm.publicBookingRequest.create).not.toHaveBeenCalled();
    });

    it("caps how many unconfirmed requests one address may hold", async () => {
      pm.publicBookingRequest.count.mockResolvedValue(3);

      await expect(
        PublicBookingRequestService.submit("park-veterinary", input),
      ).rejects.toMatchObject({ status: 429 });
      expect(pm.publicBookingRequest.create).not.toHaveBeenCalled();
    });

    it("404s when the practice offers nothing publicly", async () => {
      pm.organization.findUnique.mockResolvedValue(
        publishedOrg({
          bookingSettings: {
            serviceIds: [],
            bookingWindowDays: 28,
            bufferMinutes: 10,
            autoConfirm: false,
            welcomeMessage: null,
            replyToEmail: null,
          },
        }),
      );

      await expect(
        PublicBookingRequestService.submit("park-veterinary", input),
      ).rejects.toMatchObject({ status: 404 });
      expect(pm.publicBookingRequest.create).not.toHaveBeenCalled();
    });

    it("404s for a service that is not offered rather than saying why", async () => {
      pm.productItem.findMany.mockResolvedValue([]);

      await expect(
        PublicBookingRequestService.submit("park-veterinary", input),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("still stores the request when the confirmation email fails", async () => {
      sendEmailMock.mockRejectedValue(new Error("SES down"));

      await expect(
        PublicBookingRequestService.submit("park-veterinary", input),
      ).resolves.toBeUndefined();
      expect(pm.publicBookingRequest.create).toHaveBeenCalled();
    });

    it("does not email when no public origin is configured", async () => {
      delete process.env.PUBLIC_BOOKING_BASE_URL;

      await PublicBookingRequestService.submit("park-veterinary", input);

      expect(pm.publicBookingRequest.create).toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    const stored = (over: Record<string, unknown> = {}) => ({
      id: "req-1",
      status: "PENDING_CONFIRMATION",
      confirmationExpiresAt: new Date(Date.now() + 60_000),
      serviceName: "Wellness consultation",
      requestedStart: new Date("2026-09-01T09:00:00.000Z"),
      durationMinutes: 30,
      ownerName: "Sam Owner",
      ownerEmail: "sam@example.com",
      ownerPhone: null,
      petName: "Rex",
      petSpecies: "Dog",
      concern: null,
      organization: {
        name: "Park Veterinary",
        email: "clinic@example.com",
        bookingSlug: "park-veterinary",
        bookingSettings: { replyToEmail: "front@example.com" },
      },
      ...over,
    });

    it("looks the token up by hash, never by value", async () => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(stored());

      await PublicBookingRequestService.confirm("a".repeat(64));

      const where = pm.publicBookingRequest.findUnique.mock.calls[0][0].where;
      expect(where.confirmationTokenHash).toBe(
        createHash("sha256").update("a".repeat(64)).digest("hex"),
      );
    });

    it("confirms and notifies the practice reply-to address", async () => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(stored());

      await expect(PublicBookingRequestService.confirm("tok")).resolves.toEqual(
        {
          practiceName: "Park Veterinary",
          slug: "park-veterinary",
        },
      );

      expect(pm.publicBookingRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "CONFIRMED" }),
        }),
      );
      expect(sendEmailMock.mock.calls[0][0].to).toBe("front@example.com");
    });

    it("falls back to the organisation contact address", async () => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(
        stored({
          organization: {
            name: "Park Veterinary",
            email: "clinic@example.com",
            bookingSlug: "park-veterinary",
            bookingSettings: null,
          },
        }),
      );

      await PublicBookingRequestService.confirm("tok");
      expect(sendEmailMock.mock.calls[0][0].to).toBe("clinic@example.com");
    });

    it("confirms even when the practice has no address to notify", async () => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(
        stored({
          organization: {
            name: "Park Veterinary",
            email: null,
            bookingSlug: "park-veterinary",
            bookingSettings: null,
          },
        }),
      );

      await expect(
        PublicBookingRequestService.confirm("tok"),
      ).resolves.toBeDefined();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("confirms even when notifying the practice fails", async () => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(stored());
      sendEmailMock.mockRejectedValue(new Error("SES down"));

      await expect(
        PublicBookingRequestService.confirm("tok"),
      ).resolves.toBeDefined();
      expect(pm.publicBookingRequest.update).toHaveBeenCalled();
    });

    it.each([
      ["an unknown token", null],
      ["an already-confirmed request", { status: "CONFIRMED" }],
      [
        "an expired link",
        { confirmationExpiresAt: new Date(Date.now() - 60_000) },
      ],
    ])("returns the same 404 for %s", async (_label, override) => {
      pm.publicBookingRequest.findUnique.mockResolvedValue(
        override === null ? null : stored(override),
      );

      const error = await PublicBookingRequestService.confirm("tok").catch(
        (e) => e,
      );
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not found");
      expect(pm.publicBookingRequest.update).not.toHaveBeenCalled();
    });
  });

  describe("practice queue", () => {
    it("never lists unconfirmed requests", async () => {
      pm.publicBookingRequest.findMany.mockResolvedValue([]);

      await PublicBookingRequestService.listForOrganisation("org-1");

      const where = pm.publicBookingRequest.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({ in: ["CONFIRMED", "DECLINED", "BOOKED"] });
      expect(where.organizationId).toBe("org-1");
    });

    it("honours an explicit status filter", async () => {
      pm.publicBookingRequest.findMany.mockResolvedValue([]);

      await PublicBookingRequestService.listForOrganisation(
        "org-1",
        "DECLINED",
      );

      expect(
        pm.publicBookingRequest.findMany.mock.calls[0][0].where.status,
      ).toBe("DECLINED");
    });

    it("scopes a status change to the caller's organisation", async () => {
      pm.publicBookingRequest.updateMany.mockResolvedValue({ count: 1 });

      await PublicBookingRequestService.setStatus("org-1", "req-1", "DECLINED");

      expect(pm.publicBookingRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "req-1",
            organizationId: "org-1",
          }),
        }),
      );
    });

    it("404s rather than reporting success when nothing matched", async () => {
      pm.publicBookingRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        PublicBookingRequestService.setStatus(
          "org-1",
          "req-of-another-org",
          "BOOKED",
        ),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("retention", () => {
    it("expires stale links and deletes rows past their deadline", async () => {
      pm.publicBookingRequest.updateMany.mockResolvedValue({ count: 2 });
      pm.publicBookingRequest.deleteMany.mockResolvedValue({ count: 5 });
      const now = new Date("2026-09-01T00:00:00.000Z");

      await expect(
        PublicBookingRequestService.purgeExpired(now),
      ).resolves.toEqual({
        expired: 2,
        deleted: 5,
      });

      expect(pm.publicBookingRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "PENDING_CONFIRMATION",
            confirmationExpiresAt: { lt: now },
          },
        }),
      );
      expect(pm.publicBookingRequest.deleteMany).toHaveBeenCalledWith({
        where: { purgeAfter: { lt: now } },
      });
    });
  });
});
