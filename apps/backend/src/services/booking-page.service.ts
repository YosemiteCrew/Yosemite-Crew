import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { resolvePublicBaseUrl } from "src/utils/public-base-url";

/**
 * Configuration behind a practice's public booking page.
 *
 * The onboarding wizard used to compute `book.yosemitecrew.com/<slug>` in the
 * browser from the practice name, render it, and offer to copy it. Nothing was
 * persisted, the subdomain has no DNS record, and no route served it, so a
 * practice could paste that address onto its own website and publish a dead
 * link. This service is where that wizard's answers actually go.
 *
 * Two things it deliberately does NOT do:
 *
 *  - It never returns a URL for a practice that is not published. A caller
 *    cannot render a copyable address unless one exists, because the field is
 *    null until both `publicBookingEnabled` and `PUBLIC_BOOKING_BASE_URL` say
 *    otherwise. Honesty is a property of the payload, not of the UI copy.
 *  - It never trusts the service ids it is handed. They are re-read against the
 *    caller's own organisation before being stored, so an admin cannot pin
 *    another tenant's catalogue item onto their public page.
 */

export class BookingPageServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "BookingPageServiceError";
    this.status = status;
  }
}

/**
 * Narrow an identifier to a plain, non-empty string before it reaches a Prisma
 * `where` clause.
 *
 * Prisma filters accept objects as well as scalars, so a value that is an object
 * rather than a string turns `where: { id }` into a structured filter such as
 * `{ id: { not: "" } }` and quietly widens the query to another tenant's rows.
 * Every organisation id here arrives from `withOrgPermissions`, which already
 * rejects non-strings, so this is defence in depth rather than the only control
 * - but it is the same guard `requireSafeString` applies in the catalog service,
 * and it keeps the property local to the query instead of two files away.
 */
const requireSafeId = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new BookingPageServiceError(`${field} is required.`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("$")) {
    throw new BookingPageServiceError(`Invalid ${field}.`, 400);
  }

  return trimmed;
};

/**
 * Slugs must survive being a DNS label, not just a path segment.
 *
 * The public page ships at `/book/<slug>` on the existing origin because
 * `book.yosemitecrew.com` has no DNS record and provisioning one is not
 * something this repository can do. That decision is meant to be reversible: if
 * the subdomain is ever provisioned, `<slug>.book.yosemitecrew.com` has to be a
 * legal hostname without re-slugging every practice. So the rules here are the
 * DNS label rules - 63 characters, alphanumeric plus hyphen, no hyphen at either
 * end - rather than the much looser set a URL path would accept.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const MAX_SLUG_LENGTH = 63;

/**
 * Names the slug namespace cannot hand out.
 *
 * Two separate hazards. The routing ones (`api`, `book`, `_next`, `assets`)
 * would collide with a real path segment the moment the public route mounts
 * under the same origin. The identity ones (`admin`, `support`, `billing`,
 * `security`) are the ones someone would choose in order to look like us in a
 * link - `/book/support` reads as a Yosemite Crew page, not as a practice.
 */
const RESERVED_SLUGS = new Set([
  "_next",
  "about",
  "account",
  "admin",
  "api",
  "assets",
  "auth",
  "billing",
  "book",
  "booking",
  "cdn",
  "checkout",
  "contact",
  "dashboard",
  "developers",
  "docs",
  "favicon",
  "health",
  "help",
  "images",
  "impressum",
  "internal",
  "invoice",
  "legal",
  "login",
  "logout",
  "mail",
  "new",
  "null",
  "payment",
  "pricing",
  "privacy",
  "public",
  "robots",
  "root",
  "security",
  "settings",
  "signin",
  "signup",
  "sitemap",
  "static",
  "status",
  "support",
  "system",
  "terms",
  "undefined",
  "www",
  "yosemite",
  "yosemitecrew",
]);

/**
 * A slug that is only digits, or shaped like one of our uuids, invites the
 * reader to treat it as an internal identifier - and invites a caller to probe
 * whether `/book/1`, `/book/2` walk a sequence. Neither is ever generated from a
 * practice name, so refusing them costs nothing.
 */
const ALL_DIGITS = /^\d+$/;
const UUID_SHAPED =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Positions 3 and 4 being `--` is the punycode prefix (`xn--`). A hostname
 * carrying it is interpreted as an internationalised domain name, which is the
 * standard shape of a homograph attack. Refused for the same reason as the
 * reserved names: it is never what a practice name slugifies to.
 */
const PUNYCODE_SHAPED = /^..--/;

export const isReservedBookingSlug = (slug: string): boolean =>
  RESERVED_SLUGS.has(slug);

export const isValidBookingSlug = (slug: string): boolean =>
  SLUG_PATTERN.test(slug) &&
  slug.length <= MAX_SLUG_LENGTH &&
  !ALL_DIGITS.test(slug) &&
  !UUID_SHAPED.test(slug) &&
  !PUNYCODE_SHAPED.test(slug) &&
  !isReservedBookingSlug(slug);

/**
 * Reduce a practice name to a candidate slug.
 *
 * Diacritics are decomposed and stripped rather than dropped wholesale, so
 * "Tierärzte Grünwald" becomes `tierarzte-grunwald` and not `tier-rzte-gr-nwald`
 * - this product operates in the EU and most practice names carry them.
 */
/**
 * Trim leading and trailing hyphens.
 *
 * Deliberately not `/^-+|-+$/g`. That pattern backtracks polynomially on a
 * string of many hyphens (CodeQL js/polynomial-redos), and the input here is a
 * practice name, which the practice chooses. These two scans are linear.
 */
const trimHyphens = (value: string): string => {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "-") start += 1;
  while (end > start && value[end - 1] === "-") end -= 1;
  return value.slice(start, end);
};

export const slugifyOrganisationName = (name: string): string =>
  trimHyphens(
    trimHyphens(
      name
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-"),
    ).slice(0, MAX_SLUG_LENGTH),
  );

/**
 * Candidates to try, in order, for a practice named `name`.
 *
 * `park-veterinary`, then `park-veterinary-2` … `park-veterinary-9`. The base is
 * truncated before the suffix is appended so a 63-character name cannot produce
 * a 65-character candidate that the DNS rule would then reject.
 */
const buildSlugCandidates = (name: string): string[] => {
  const base = slugifyOrganisationName(name);
  const candidates: string[] = [];

  if (isValidBookingSlug(base)) candidates.push(base);

  // A reserved base still makes a good stem: a practice actually called
  // "Support" should end up at `support-2`, not at `clinic-2`. Only a base that
  // slugified to nothing falls back to a generic stem.
  const stem = (base || "clinic").slice(0, MAX_SLUG_LENGTH - 2);
  for (let n = 2; n <= 9; n += 1) {
    candidates.push(`${stem}-${n}`);
  }

  return candidates.filter(isValidBookingSlug);
};

/**
 * Guaranteed-terminating fallback once the readable candidates are taken.
 *
 * Eight hex characters, so a collision here is not something a caller can drive
 * by registering practices in a loop.
 */
const buildRandomSlug = (name: string): string => {
  const stem = (slugifyOrganisationName(name) || "clinic").slice(
    0,
    MAX_SLUG_LENGTH - 9,
  );
  return `${stem}-${randomBytes(4).toString("hex")}`;
};

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * Raised when a concurrent request allocated this organisation's slug first.
 *
 * Not an error condition - the caller re-reads the slug that won and returns it.
 * It exists so the transaction can roll back its own reservation rather than
 * leaving a row behind for a slug the organisation is not actually using.
 */
class SlugAlreadyAllocatedError extends Error {
  constructor() {
    super("Booking slug was allocated concurrently");
    this.name = "SlugAlreadyAllocatedError";
  }
}

/**
 * Claim `slug` for `organizationId`, or report that it is not available.
 *
 * Two races, two guards, and both are decided by the database rather than by a
 * read-then-write in application code:
 *
 *  - Two organisations wanting the same slug collide on the reservation's
 *    primary key. The loser gets `false` and tries the next candidate.
 *  - Two concurrent requests for the SAME organisation collide on the
 *    `bookingSlug IS NULL` guard in the update. Without it, the second request
 *    would claim a second reservation and overwrite the pointer, leaving the
 *    first, nicer slug stranded - owned by this organisation, in use by nobody,
 *    and unavailable to the practice next door. The guard makes the loser roll
 *    back instead, and `ensureBookingSlug` returns the slug that won.
 */
const claimSlug = async (
  organizationId: string,
  slug: string,
): Promise<boolean> => {
  const safeOrganizationId = requireSafeId(organizationId, "organisationId");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bookingSlugReservation.create({
        data: { slug, organizationId: safeOrganizationId },
      });

      // Raw, parameterised UPDATE rather than `update` or `updateMany`.
      //
      // `update` addresses a row by unique key and cannot carry the extra
      // "still unallocated" predicate. `updateMany` can, but its `where` is a
      // Prisma filter object, so a non-string id would become a filter operator
      // rather than an equality test and silently widen the statement. A tagged
      // template binds both values as query parameters, where an object cannot
      // be reinterpreted as an operator at all.
      const claimed = await tx.$executeRaw`
        UPDATE "Organization"
        SET "bookingSlug" = ${slug}
        WHERE "id" = ${safeOrganizationId} AND "bookingSlug" IS NULL
      `;

      if (claimed === 0) throw new SlugAlreadyAllocatedError();
    });
    return true;
  } catch (error: unknown) {
    if (error instanceof SlugAlreadyAllocatedError) {
      throw error;
    }
    if (isUniqueViolation(error)) return false;
    throw error;
  }
};

/**
 * Read back the slug a concurrent request allocated for this organisation.
 */
const readAllocatedSlug = async (organisationId: string): Promise<string> => {
  const organisation = await prisma.organization.findUnique({
    where: { id: requireSafeId(organisationId, "organisationId") },
    select: { bookingSlug: true },
  });

  if (!organisation?.bookingSlug) {
    throw new BookingPageServiceError(
      "Could not allocate a booking address. Please try again.",
      503,
    );
  }
  return organisation.bookingSlug;
};

/**
 * Return the practice's booking slug, allocating one on first use.
 *
 * Idempotent: a practice that already has a slug keeps it. Renaming is a
 * separate, deliberate act - it retires nothing, it adds a new reservation and
 * moves the pointer, so the old slug keeps resolving.
 */
export const ensureBookingSlug = async (
  organisationId: string,
): Promise<string> => {
  const organisation = await prisma.organization.findUnique({
    where: { id: requireSafeId(organisationId, "organisationId") },
    select: { id: true, name: true, bookingSlug: true },
  });

  if (!organisation) {
    throw new BookingPageServiceError("Organisation not found", 404);
  }
  if (organisation.bookingSlug) return organisation.bookingSlug;

  try {
    for (const candidate of buildSlugCandidates(organisation.name)) {
      if (await claimSlug(organisationId, candidate)) return candidate;
    }

    // Readable candidates exhausted. Random suffixes cannot realistically
    // collide, but the loop is bounded anyway so a pathological database cannot
    // hang the request.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = buildRandomSlug(organisation.name);
      if (await claimSlug(organisationId, candidate)) return candidate;
    }
  } catch (error: unknown) {
    if (!(error instanceof SlugAlreadyAllocatedError)) throw error;
    return readAllocatedSlug(organisationId);
  }

  throw new BookingPageServiceError(
    "Could not allocate a booking address. Please try again.",
    503,
  );
};

/**
 * Absolute URL of the public booking page, or null when there is not one yet.
 *
 * Null in three cases, and every one of them is a case where showing an address
 * would be a lie: the practice has no slug, the practice has not opted in, or
 * no origin is configured for this environment. `PUBLIC_BOOKING_BASE_URL` being
 * unset is the normal state until the public route ships, which is exactly what
 * keeps the wizard honest in the meantime.
 */
export const resolveBookingPageUrl = (
  slug: string | null,
  publicBookingEnabled: boolean,
): string | null => {
  if (!slug || !publicBookingEnabled) return null;

  const base = resolvePublicBaseUrl([process.env.PUBLIC_BOOKING_BASE_URL]);
  if (!base) return null;

  return `${base}/book/${slug}`;
};

export type BookingPageConfig = {
  organisationId: string;
  slug: string | null;
  publicBookingEnabled: boolean;
  publicUrl: string | null;
  serviceIds: string[];
  bookingWindowDays: number;
  bufferMinutes: number;
  autoConfirm: boolean;
  welcomeMessage: string | null;
  replyToEmail: string | null;
};

const DEFAULT_BOOKING_WINDOW_DAYS = 28;
const DEFAULT_BUFFER_MINUTES = 10;

const toConfig = (
  organisationId: string,
  organisation: { bookingSlug: string | null; publicBookingEnabled: boolean },
  settings: {
    serviceIds: string[];
    bookingWindowDays: number;
    bufferMinutes: number;
    autoConfirm: boolean;
    welcomeMessage: string | null;
    replyToEmail: string | null;
  } | null,
): BookingPageConfig => ({
  organisationId,
  slug: organisation.bookingSlug,
  publicBookingEnabled: organisation.publicBookingEnabled,
  publicUrl: resolveBookingPageUrl(
    organisation.bookingSlug,
    organisation.publicBookingEnabled,
  ),
  serviceIds: settings?.serviceIds ?? [],
  bookingWindowDays: settings?.bookingWindowDays ?? DEFAULT_BOOKING_WINDOW_DAYS,
  bufferMinutes: settings?.bufferMinutes ?? DEFAULT_BUFFER_MINUTES,
  autoConfirm: settings?.autoConfirm ?? false,
  welcomeMessage: settings?.welcomeMessage ?? null,
  replyToEmail: settings?.replyToEmail ?? null,
});

export type BookingPageSettingsInput = {
  serviceIds: string[];
  bookingWindowDays: number;
  bufferMinutes: number;
  autoConfirm: boolean;
  welcomeMessage?: string | null;
  replyToEmail?: string | null;
};

export const BookingPageService = {
  /**
   * Current configuration. A practice that has never opened the wizard gets the
   * defaults rather than a 404, so the caller has one shape to render.
   */
  async getConfig(organisationId: string): Promise<BookingPageConfig> {
    const safeOrganisationId = requireSafeId(organisationId, "organisationId");

    const organisation = await prisma.organization.findUnique({
      where: { id: safeOrganisationId },
      select: { bookingSlug: true, publicBookingEnabled: true },
    });

    if (!organisation) {
      throw new BookingPageServiceError("Organisation not found", 404);
    }

    const settings = await prisma.publicBookingSettings.findUnique({
      where: { organizationId: safeOrganisationId },
      select: {
        serviceIds: true,
        bookingWindowDays: true,
        bufferMinutes: true,
        autoConfirm: true,
        welcomeMessage: true,
        replyToEmail: true,
      },
    });

    return toConfig(safeOrganisationId, organisation, settings);
  },

  /**
   * Persist the wizard's answers and allocate a slug on first save.
   *
   * `serviceIds` is filtered against the caller's own organisation before it is
   * written. `withOrgPermissions` has already proved the caller belongs to
   * `organisationId`, but it says nothing about the ids in the body - without
   * this read, an admin could pin another practice's catalogue item onto their
   * own public page, and the public renderer would later resolve it.
   */
  async saveConfig(
    organisationId: string,
    input: BookingPageSettingsInput,
  ): Promise<BookingPageConfig> {
    const safeOrganisationId = requireSafeId(organisationId, "organisationId");
    // Each id is narrowed individually: `{ in: [...] }` is only safe if every
    // element is a scalar, and the array arrives from the request body.
    const requested = [
      ...new Set(input.serviceIds.map((id) => requireSafeId(id, "serviceId"))),
    ];

    const owned =
      requested.length === 0
        ? []
        : await prisma.productItem.findMany({
            where: {
              id: { in: requested },
              organisationId: safeOrganisationId,
              isActive: true,
              bookable: { isNot: null },
            },
            select: { id: true },
          });

    const ownedIds = new Set(owned.map((item) => item.id));
    const rejected = requested.filter((id) => !ownedIds.has(id));
    if (rejected.length > 0) {
      throw new BookingPageServiceError(
        "One or more selected services are not bookable services of this organisation.",
        400,
      );
    }

    await ensureBookingSlug(safeOrganisationId);

    const settingsData = {
      serviceIds: requested,
      bookingWindowDays: input.bookingWindowDays,
      bufferMinutes: input.bufferMinutes,
      autoConfirm: input.autoConfirm,
      welcomeMessage: input.welcomeMessage?.trim() || null,
      replyToEmail: input.replyToEmail?.trim().toLowerCase() || null,
    };

    await prisma.publicBookingSettings.upsert({
      where: { organizationId: safeOrganisationId },
      create: { organizationId: safeOrganisationId, ...settingsData },
      update: settingsData,
    });

    return BookingPageService.getConfig(safeOrganisationId);
  },
};
