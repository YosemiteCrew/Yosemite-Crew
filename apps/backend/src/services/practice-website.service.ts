import { prisma } from "src/config/prisma";
import { resolvePublicBaseUrl } from "src/utils/public-base-url";
import {
  PublicBookingService,
  resolveSlug,
  type PublicPractice,
} from "src/services/public-booking.service";

/**
 * The clinic website a practice builds in the website builder.
 *
 * A site is a template plus a few lines of the practice's own copy, rendered
 * around the practice's public booking page. That dependency is deliberate and
 * enforced here rather than in the UI: every template's call to action is
 * "Book an appointment", so a site that goes live while booking is off would
 * publish a button that leads nowhere. Publishing therefore requires a live
 * booking page, and the public read re-checks both flags on every request, so
 * turning booking off takes the site down with it.
 */

export class PracticeWebsiteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PracticeWebsiteError";
    this.status = status;
  }
}

/** The templates the builder offers. The frontend renders one layout per id. */
export const WEBSITE_TEMPLATE_IDS = [
  "alpine-clinic",
  "city-vets",
  "equine-estate",
] as const;

export type WebsiteTemplateId = (typeof WEBSITE_TEMPLATE_IDS)[number];

export const isWebsiteTemplateId = (
  value: string,
): value is WebsiteTemplateId =>
  (WEBSITE_TEMPLATE_IDS as readonly string[]).includes(value);

export type PracticeWebsiteContent = {
  templateId: WebsiteTemplateId;
  headline: string;
  tagline: string | null;
  about: string | null;
};

export type PracticeWebsiteConfig = PracticeWebsiteContent & {
  organisationId: string;
  /** Whether the practice has ever saved a site. */
  configured: boolean;
  published: boolean;
  publishedAt: string | null;
  slug: string | null;
  /** Whether the public booking page is live, which publishing requires. */
  publicBookingEnabled: boolean;
  /** The site's address, only while it is actually reachable. */
  publicUrl: string | null;
};

export type PracticeWebsiteInput = PracticeWebsiteContent & {
  published: boolean;
};

export type PublicPracticeSite = PracticeWebsiteContent & {
  practice: PublicPractice;
};

const requireSafeId = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim() || value.includes("$")) {
    throw new PracticeWebsiteError("Invalid organisationId.", 400);
  }
  return value.trim();
};

const notFound = () => new PracticeWebsiteError("Site not found", 404);

/**
 * The public site shares the booking page's origin, so it takes the same base
 * URL. Null whenever the site would not answer, so the builder can never show a
 * copyable address for a page that does not exist.
 */
export const resolveWebsiteUrl = (
  slug: string | null,
  reachable: boolean,
): string | null => {
  if (!slug || !reachable) return null;
  const base = resolvePublicBaseUrl([process.env.PUBLIC_BOOKING_BASE_URL]);
  return base ? `${base}/site/${encodeURIComponent(slug)}` : null;
};

const defaultContent = (organisationName: string): PracticeWebsiteContent => ({
  templateId: "alpine-clinic",
  headline: organisationName,
  tagline: null,
  about: null,
});

const toTemplateId = (value: string): WebsiteTemplateId =>
  isWebsiteTemplateId(value) ? value : "alpine-clinic";

export const PracticeWebsiteService = {
  async getConfig(organisationId: string): Promise<PracticeWebsiteConfig> {
    const safeId = requireSafeId(organisationId);

    const organisation = await prisma.organization.findUnique({
      where: { id: safeId },
      select: {
        name: true,
        bookingSlug: true,
        publicBookingEnabled: true,
        practiceWebsite: {
          select: {
            templateId: true,
            headline: true,
            tagline: true,
            about: true,
            published: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new PracticeWebsiteError("Organisation not found", 404);
    }

    const site = organisation.practiceWebsite;
    const content: PracticeWebsiteContent = site
      ? {
          templateId: toTemplateId(site.templateId),
          headline: site.headline,
          tagline: site.tagline,
          about: site.about,
        }
      : defaultContent(organisation.name);
    const published = site?.published ?? false;

    return {
      organisationId: safeId,
      configured: site !== null,
      ...content,
      published,
      publishedAt: site?.publishedAt?.toISOString() ?? null,
      slug: organisation.bookingSlug,
      publicBookingEnabled: organisation.publicBookingEnabled,
      publicUrl: resolveWebsiteUrl(
        organisation.bookingSlug,
        published && organisation.publicBookingEnabled,
      ),
    };
  },

  /**
   * Save the site, and publish or unpublish it.
   *
   * Publishing is refused with 409 while the booking page is not live. Saving
   * a draft and unpublishing are always allowed, so a practice can prepare a
   * site before it opens booking.
   */
  async saveConfig(
    organisationId: string,
    input: PracticeWebsiteInput,
  ): Promise<PracticeWebsiteConfig> {
    const safeId = requireSafeId(organisationId);

    const organisation = await prisma.organization.findUnique({
      where: { id: safeId },
      select: {
        bookingSlug: true,
        publicBookingEnabled: true,
        practiceWebsite: { select: { published: true, publishedAt: true } },
      },
    });

    if (!organisation) {
      throw new PracticeWebsiteError("Organisation not found", 404);
    }

    if (
      input.published &&
      !(organisation.publicBookingEnabled && organisation.bookingSlug)
    ) {
      throw new PracticeWebsiteError(
        "Turn on online booking before publishing the website.",
        409,
      );
    }

    // Keep the first publish time while the site stays live; a fresh publish
    // after taking the site down records a new one.
    const wasPublished = organisation.practiceWebsite?.published ?? false;
    let publishedAt: Date | null = null;
    if (input.published) {
      publishedAt = wasPublished
        ? (organisation.practiceWebsite?.publishedAt ?? new Date())
        : new Date();
    }

    const data = {
      templateId: input.templateId,
      headline: input.headline,
      tagline: input.tagline,
      about: input.about,
      published: input.published,
      publishedAt,
    };

    await prisma.practiceWebsite.upsert({
      where: { organizationId: safeId },
      create: { organizationId: safeId, ...data },
      update: data,
    });

    return PracticeWebsiteService.getConfig(safeId);
  },

  /**
   * The published site for a slug, for anyone on the internet.
   *
   * One 404 for every reason it is not shown: unknown slug, booking off, site
   * never saved, or saved but not published. A retired slug answers with the
   * slug to redirect to, the same way the booking page does.
   */
  async getPublicSite(
    rawSlug: string,
  ): Promise<
    | { kind: "site"; site: PublicPracticeSite }
    | { kind: "redirect"; slug: string }
  > {
    const resolved = await resolveSlug(rawSlug);
    if (resolved.kind === "retired") {
      return { kind: "redirect", slug: resolved.slug };
    }

    const site = await prisma.practiceWebsite.findUnique({
      where: { organizationId: resolved.practice.organizationId },
      select: {
        templateId: true,
        headline: true,
        tagline: true,
        about: true,
        published: true,
      },
    });
    if (!site?.published) throw notFound();

    const practice = await PublicBookingService.getPractice(
      resolved.practice.slug,
    );

    return {
      kind: "site",
      site: {
        templateId: toTemplateId(site.templateId),
        headline: site.headline,
        tagline: site.tagline,
        about: site.about,
        practice,
      },
    };
  },
};

export default PracticeWebsiteService;
