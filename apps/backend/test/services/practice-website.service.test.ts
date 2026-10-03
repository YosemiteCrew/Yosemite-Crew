import {
  isWebsiteTemplateId,
  PracticeWebsiteError,
  PracticeWebsiteService,
  resolveWebsiteUrl,
} from "src/services/practice-website.service";
import { prisma } from "src/config/prisma";
import {
  PublicBookingError,
  PublicBookingService,
  resolveSlug,
} from "src/services/public-booking.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: { findUnique: jest.fn() },
    practiceWebsite: { findUnique: jest.fn(), upsert: jest.fn() },
  },
}));

jest.mock("src/services/public-booking.service", () => {
  const actual = jest.requireActual("src/services/public-booking.service");
  return {
    ...actual,
    resolveSlug: jest.fn(),
    PublicBookingService: { getPractice: jest.fn() },
  };
});

const pm = prisma as unknown as {
  organization: { findUnique: jest.Mock };
  practiceWebsite: { findUnique: jest.Mock; upsert: jest.Mock };
};
const mockResolveSlug = resolveSlug as jest.Mock;
const mockGetPractice = PublicBookingService.getPractice as jest.Mock;

const ORG = "org-1";

const storedSite = {
  templateId: "city-vets",
  headline: "Park Vets",
  tagline: "Open late",
  about: "Family practice.",
  published: true,
  publishedAt: new Date("2026-09-01T10:00:00.000Z"),
};

const orgRow = (overrides: Record<string, unknown> = {}) => ({
  name: "Park Vets Clinic",
  bookingSlug: "park-vets",
  publicBookingEnabled: true,
  practiceWebsite: storedSite,
  ...overrides,
});

const input = {
  templateId: "alpine-clinic" as const,
  headline: "Park Vets",
  tagline: null,
  about: null,
  published: true,
};

describe("practice-website.service", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PUBLIC_BOOKING_BASE_URL = "https://book.example.test/";
    pm.practiceWebsite.upsert.mockResolvedValue({});
  });

  afterAll(() => {
    delete process.env.PUBLIC_BOOKING_BASE_URL;
  });

  describe("isWebsiteTemplateId", () => {
    it("accepts the offered templates only", () => {
      expect(isWebsiteTemplateId("equine-estate")).toBe(true);
      expect(isWebsiteTemplateId("brutalist")).toBe(false);
    });
  });

  describe("resolveWebsiteUrl", () => {
    it("builds the site address on the booking origin", () => {
      expect(resolveWebsiteUrl("park-vets", true)).toBe(
        "https://book.example.test/site/park-vets",
      );
    });

    it("is null while the site is not reachable", () => {
      expect(resolveWebsiteUrl("park-vets", false)).toBeNull();
      expect(resolveWebsiteUrl(null, true)).toBeNull();
    });

    it("is null when no base URL is configured", () => {
      delete process.env.PUBLIC_BOOKING_BASE_URL;
      expect(resolveWebsiteUrl("park-vets", true)).toBeNull();
    });
  });

  describe("getConfig", () => {
    it("returns the saved site with its live address", async () => {
      pm.organization.findUnique.mockResolvedValue(orgRow());

      await expect(PracticeWebsiteService.getConfig(ORG)).resolves.toEqual({
        organisationId: ORG,
        configured: true,
        templateId: "city-vets",
        headline: "Park Vets",
        tagline: "Open late",
        about: "Family practice.",
        published: true,
        publishedAt: "2026-09-01T10:00:00.000Z",
        slug: "park-vets",
        publicBookingEnabled: true,
        publicUrl: "https://book.example.test/site/park-vets",
      });
    });

    it("defaults an unsaved site to the practice name and no address", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ practiceWebsite: null }),
      );

      const config = await PracticeWebsiteService.getConfig(ORG);
      expect(config).toMatchObject({
        configured: false,
        templateId: "alpine-clinic",
        headline: "Park Vets Clinic",
        published: false,
        publishedAt: null,
        publicUrl: null,
      });
    });

    it("hides the address of a published site while booking is off", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ publicBookingEnabled: false }),
      );

      const config = await PracticeWebsiteService.getConfig(ORG);
      expect(config.published).toBe(true);
      expect(config.publicUrl).toBeNull();
    });

    it("falls back to the default template for an unknown stored id", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ practiceWebsite: { ...storedSite, templateId: "retired" } }),
      );

      const config = await PracticeWebsiteService.getConfig(ORG);
      expect(config.templateId).toBe("alpine-clinic");
    });

    it("404s for a missing organisation", async () => {
      pm.organization.findUnique.mockResolvedValue(null);

      await expect(PracticeWebsiteService.getConfig(ORG)).rejects.toMatchObject(
        {
          status: 404,
        },
      );
    });

    it.each([[""], ["  "], ["org$1"], [{ not: "" }]])(
      "rejects an unsafe organisation id %p before querying",
      async (value) => {
        await expect(
          PracticeWebsiteService.getConfig(value as unknown as string),
        ).rejects.toBeInstanceOf(PracticeWebsiteError);
        expect(pm.organization.findUnique).not.toHaveBeenCalled();
      },
    );
  });

  describe("saveConfig", () => {
    it("refuses to publish while booking is off", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ publicBookingEnabled: false, practiceWebsite: null }),
      );

      await expect(
        PracticeWebsiteService.saveConfig(ORG, input),
      ).rejects.toMatchObject({ status: 409 });
      expect(pm.practiceWebsite.upsert).not.toHaveBeenCalled();
    });

    it("refuses to publish a practice with no slug", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ bookingSlug: null, practiceWebsite: null }),
      );

      await expect(
        PracticeWebsiteService.saveConfig(ORG, input),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("saves a draft while booking is off", async () => {
      pm.organization.findUnique
        .mockResolvedValueOnce(
          orgRow({ publicBookingEnabled: false, practiceWebsite: null }),
        )
        .mockResolvedValueOnce(
          orgRow({ publicBookingEnabled: false, practiceWebsite: null }),
        );

      await PracticeWebsiteService.saveConfig(ORG, {
        ...input,
        published: false,
      });

      expect(pm.practiceWebsite.upsert).toHaveBeenCalledWith({
        where: { organizationId: ORG },
        create: {
          organizationId: ORG,
          templateId: "alpine-clinic",
          headline: "Park Vets",
          tagline: null,
          about: null,
          published: false,
          publishedAt: null,
        },
        update: {
          templateId: "alpine-clinic",
          headline: "Park Vets",
          tagline: null,
          about: null,
          published: false,
          publishedAt: null,
        },
      });
    });

    it("stamps a first publish with the current time", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ practiceWebsite: null }),
      );
      const before = Date.now();

      await PracticeWebsiteService.saveConfig(ORG, input);

      const stamped = pm.practiceWebsite.upsert.mock.calls[0][0].update
        .publishedAt as Date;
      expect(stamped.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("keeps the original publish time while the site stays live", async () => {
      pm.organization.findUnique.mockResolvedValue(orgRow());

      await PracticeWebsiteService.saveConfig(ORG, input);

      expect(
        pm.practiceWebsite.upsert.mock.calls[0][0].update.publishedAt,
      ).toEqual(storedSite.publishedAt);
    });

    it("records a new publish time after the site was taken down", async () => {
      pm.organization.findUnique.mockResolvedValue(
        orgRow({ practiceWebsite: { ...storedSite, published: false } }),
      );

      await PracticeWebsiteService.saveConfig(ORG, input);

      expect(
        pm.practiceWebsite.upsert.mock.calls[0][0].update.publishedAt,
      ).not.toEqual(storedSite.publishedAt);
    });

    it("404s for a missing organisation", async () => {
      pm.organization.findUnique.mockResolvedValue(null);

      await expect(
        PracticeWebsiteService.saveConfig(ORG, input),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe("getPublicSite", () => {
    const practice = { slug: "park-vets", name: "Park Vets", services: [] };

    beforeEach(() => {
      mockResolveSlug.mockResolvedValue({
        kind: "current",
        practice: { organizationId: ORG, slug: "park-vets" },
      });
      mockGetPractice.mockResolvedValue(practice);
    });

    it("returns the published site with the practice", async () => {
      pm.practiceWebsite.findUnique.mockResolvedValue(storedSite);

      await expect(
        PracticeWebsiteService.getPublicSite("park-vets"),
      ).resolves.toEqual({
        kind: "site",
        site: {
          templateId: "city-vets",
          headline: "Park Vets",
          tagline: "Open late",
          about: "Family practice.",
          practice,
        },
      });
      expect(pm.practiceWebsite.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG } }),
      );
    });

    it("redirects a retired slug", async () => {
      mockResolveSlug.mockResolvedValue({ kind: "retired", slug: "new-vets" });

      await expect(
        PracticeWebsiteService.getPublicSite("park-vets"),
      ).resolves.toEqual({ kind: "redirect", slug: "new-vets" });
      expect(pm.practiceWebsite.findUnique).not.toHaveBeenCalled();
    });

    it.each([[null], [{ ...storedSite, published: false }]])(
      "404s when the site is missing or unpublished (%p)",
      async (row) => {
        pm.practiceWebsite.findUnique.mockResolvedValue(row);

        await expect(
          PracticeWebsiteService.getPublicSite("park-vets"),
        ).rejects.toMatchObject({ status: 404 });
        expect(mockGetPractice).not.toHaveBeenCalled();
      },
    );

    it("passes through the booking page's 404 when booking is off", async () => {
      mockResolveSlug.mockRejectedValue(
        new PublicBookingError("Not found", 404),
      );

      await expect(
        PracticeWebsiteService.getPublicSite("park-vets"),
      ).rejects.toBeInstanceOf(PublicBookingError);
    });
  });
});
