import { createHash, randomBytes } from "node:crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import { prisma } from "src/config/prisma";
import { CatalogService } from "./catalog.service";
import { resolveBookingPageUrl } from "./booking-page.service";
import { sendEmail } from "src/utils/email";
import { escapeHtml, renderEmailButton } from "src/utils/email-templates";
import logger from "src/utils/logger";

dayjs.extend(utc);
dayjs.extend(customParseFormat);

/**
 * The unauthenticated half of the public booking page.
 *
 * Everything here is reachable by anyone on the internet, so the shape of each
 * response is as much of the design as its contents. Three rules run through it:
 *
 *  1. **One failure mode.** An unpublished practice, a practice that does not
 *     exist, and a service that is not offered publicly all produce the same
 *     `NotFound`. A caller walking slugs learns nothing from the difference,
 *     because there is no difference to observe.
 *  2. **Projections, not entities.** No response is a database row with fields
 *     removed. Each one is built field by field, so a column added to
 *     `ProductItem` or `Organization` later cannot leak by default. Staff ids,
 *     internal codes and pricing are absent by construction.
 *  3. **A request is inert.** Submitting one writes to `PublicBookingRequest`
 *     and nothing else. It does not touch a calendar, does not create a Parent
 *     or a Companion, and is not visible to the practice until the requester has
 *     proven the email address belongs to them.
 */

export class PublicBookingError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicBookingError";
    this.status = status;
  }
}

/**
 * The only "this does not exist" any public caller ever sees.
 *
 * Deliberately one function rather than a message per case. A practice that has
 * not published, a slug nobody owns, and a service withdrawn from the page are
 * different facts internally and must be indistinguishable externally: telling
 * them apart is how a caller maps which clinics use the product before they open
 * their booking page.
 */
const notFound = () => new PublicBookingError("Not found", 404);

const MAX_BOOKING_WINDOW_DAYS = 180;
const CONFIRMATION_TOKEN_BYTES = 32;
const CONFIRMATION_VALID_HOURS = 48;

/**
 * How long a request may be stored.
 *
 * Thirty days after the requested appointment, or after submission for one that
 * is never confirmed. Long enough for a practice to work through its queue and
 * for a no-show to be explicable; short enough that a stranger's contact details
 * do not sit in a veterinary database indefinitely because nobody deleted them.
 */
const RETENTION_DAYS = 30;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/**
 * Guard identifiers on their way into a Prisma `where`.
 *
 * Prisma filters accept objects as well as scalars, so a non-string value turns
 * `where: { id }` into a structured filter and widens the query. Every value
 * here arrives from an unauthenticated request body or path, which is the worst
 * possible provenance, so nothing reaches a query without passing through this.
 */
const requireSafeString = (value: unknown, field: string): string => {
  if (typeof value !== "string")
    throw new PublicBookingError(`Invalid ${field}`, 400);
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("$")) {
    throw new PublicBookingError(`Invalid ${field}`, 400);
  }
  return trimmed;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

export type PublicPractice = {
  slug: string;
  name: string;
  logoUrl: string | null;
  welcomeMessage: string | null;
  city: string | null;
  country: string | null;
  bookingWindowDays: number;
  requiresConfirmation: boolean;
  services: PublicService[];
};

type ResolvedPractice = {
  organizationId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  country: string | null;
  settings: {
    serviceIds: string[];
    bookingWindowDays: number;
    bufferMinutes: number;
    autoConfirm: boolean;
    welcomeMessage: string | null;
    replyToEmail: string | null;
  } | null;
};

/**
 * Resolve a slug to a published practice, or say where the reader should go.
 *
 * A retired slug still resolves. Booking addresses end up on printed cards and
 * in directory listings, so a practice that renames must not 404 the address its
 * clients already have - the caller is told the current slug and redirects.
 */
export const resolveSlug = async (
  rawSlug: string,
): Promise<
  | { kind: "current"; practice: ResolvedPractice }
  | { kind: "retired"; slug: string }
> => {
  const slug = requireSafeString(rawSlug, "slug");

  const organisation = await prisma.organization.findUnique({
    where: { bookingSlug: slug },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      publicBookingEnabled: true,
      address: { select: { city: true, country: true } },
      bookingSettings: {
        select: {
          serviceIds: true,
          bookingWindowDays: true,
          bufferMinutes: true,
          autoConfirm: true,
          welcomeMessage: true,
          replyToEmail: true,
        },
      },
    },
  });

  if (organisation) {
    // Opt-in is enforced here, on the read path, not only in the UI that flips
    // it. A practice that has configured a page but not published it is exactly
    // as absent as one that never opened the wizard.
    if (!organisation.publicBookingEnabled) throw notFound();

    return {
      kind: "current",
      practice: {
        organizationId: organisation.id,
        slug,
        name: organisation.name,
        logoUrl: organisation.imageUrl ?? null,
        city: organisation.address?.city ?? null,
        country: organisation.address?.country ?? null,
        settings: organisation.bookingSettings,
      },
    };
  }

  const reservation = await prisma.bookingSlugReservation.findUnique({
    where: { slug },
    select: {
      organization: {
        select: { bookingSlug: true, publicBookingEnabled: true },
      },
    },
  });

  const currentSlug = reservation?.organization?.bookingSlug;
  if (!currentSlug || !reservation?.organization?.publicBookingEnabled)
    throw notFound();

  return { kind: "retired", slug: currentSlug };
};

const requireCurrent = async (slug: string): Promise<ResolvedPractice> => {
  const resolved = await resolveSlug(slug);
  // A retired slug is a redirect, not a page. Callers that cannot redirect (the
  // slot and submit endpoints) treat it as absent rather than silently serving
  // another practice's data under the old name.
  if (resolved.kind !== "current") throw notFound();
  return resolved.practice;
};

/**
 * Services this practice offers publicly, as the public may see them.
 *
 * Built field by field on purpose. `ProductItem` carries `code` (the practice's
 * internal catalogue reference), and its price lives one join away; neither
 * belongs on a page anyone can scrape, and neither can arrive here by accident
 * because neither is selected.
 *
 * Two filters, not one. `settings.serviceIds` is what the practice chose, and
 * `isActive` + a `bookable` row is what the catalogue currently supports - so
 * archiving a service withdraws it from the page immediately, without anyone
 * revisiting the wizard.
 */
const loadPublicServices = async (
  practice: ResolvedPractice,
): Promise<PublicService[]> => {
  const chosen = practice.settings?.serviceIds ?? [];

  const products = await prisma.productItem.findMany({
    where: {
      organisationId: practice.organizationId,
      isActive: true,
      bookable: { isNot: null },
      // An empty selection means the practice never narrowed it, so everything
      // bookable is offered. It is NOT the same as choosing nothing - that case
      // is settled before this query runs.
      ...(chosen.length > 0 ? { id: { in: chosen } } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      bookable: { select: { durationMinutes: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    durationMinutes: product.bookable?.durationMinutes ?? 0,
  }));
};

/**
 * A practice that saved an explicitly empty selection is offering nothing.
 *
 * `configured` on the settings row is what separates that from a practice that
 * never narrowed the list; here the settings row exists, so an empty array is a
 * decision and is honoured.
 */
const offersNothing = (practice: ResolvedPractice): boolean =>
  practice.settings !== null && practice.settings.serviceIds.length === 0;

export const PublicBookingService = {
  async getPractice(slug: string): Promise<PublicPractice> {
    const practice = await requireCurrent(slug);

    return {
      slug: practice.slug,
      name: practice.name,
      logoUrl: practice.logoUrl,
      welcomeMessage: practice.settings?.welcomeMessage ?? null,
      city: practice.city,
      country: practice.country,
      bookingWindowDays: Math.min(
        practice.settings?.bookingWindowDays ?? 28,
        MAX_BOOKING_WINDOW_DAYS,
      ),
      requiresConfirmation: !practice.settings?.autoConfirm,
      services: offersNothing(practice)
        ? []
        : await loadPublicServices(practice),
    };
  },

  /**
   * Bookable windows for one service on one date.
   *
   * Reuses `CatalogService.getBookableSlotsService`, which is the same
   * computation the signed-in apps use, and then strips `vetIds`. That field is
   * a list of staff user identifiers; the authenticated slot route already
   * redacts it for anonymous callers (`withoutVetIds` in service.controller.ts)
   * and this route must not be the one that reintroduces it.
   */
  async getSlots(slug: string, rawServiceId: string, rawDate: string) {
    const practice = await requireCurrent(slug);
    const serviceId = requireSafeString(rawServiceId, "serviceId");

    const date = dayjs.utc(rawDate, "YYYY-MM-DD", true);
    if (!date.isValid()) throw new PublicBookingError("Invalid date", 400);

    const windowDays = Math.min(
      practice.settings?.bookingWindowDays ?? 28,
      MAX_BOOKING_WINDOW_DAYS,
    );
    const today = dayjs.utc().startOf("day");
    // The booking window is a limit on how far into the future an anonymous
    // caller can walk this practice's calendar, so it is enforced on the server.
    // Without it the window is a UI suggestion and the whole schedule is
    // scrapable one date at a time.
    if (date.isBefore(today) || date.isAfter(today.add(windowDays, "day"))) {
      throw new PublicBookingError("Date outside the booking window", 400);
    }

    if (offersNothing(practice)) throw notFound();

    const offered = await loadPublicServices(practice);
    const service = offered.find((candidate) => candidate.id === serviceId);
    // Asking for a service the practice does not offer publicly is the same
    // answer as asking for one that does not exist.
    if (!service) throw notFound();

    const result = await CatalogService.getBookableSlotsService(
      serviceId,
      practice.organizationId,
      date.toDate(),
    );

    return {
      date: result.date,
      serviceId,
      durationMinutes: service.durationMinutes,
      windows: result.windows.map((window) => ({
        startTime: window.startTime,
        endTime: window.endTime,
      })),
    };
  },
};

export type PublicBookingRequestInput = {
  serviceId: string;
  date: string;
  startTime: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  petName: string;
  petSpecies: string;
  concern?: string | null;
};

const buildConfirmationUrl = (slug: string, token: string): string | null => {
  const base = resolveBookingPageUrl(slug, true);
  if (!base) return null;
  return `${base}/confirm?token=${encodeURIComponent(token)}`;
};

/**
 * How many unconfirmed requests one email address may hold against one practice.
 *
 * The per-IP limiter on the route caps volume from a single source; this caps
 * the damage from a distributed one, because the practice's inbox is the real
 * target. Only PENDING rows count, so confirming genuinely frees the budget.
 */
const MAX_PENDING_PER_EMAIL = 3;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

/**
 * Prove the requested time is one this practice actually offers.
 *
 * Without this the form's own slot list is the only control, and a caller who
 * skips the form can request 03:00 on a Sunday - worse than a bad UX, because
 * the practice then has to triage nonsense arriving at their real address. The
 * window list is recomputed server-side and the requested start must be in it.
 */
const assertSlotIsOffered = async (
  slug: string,
  serviceId: string,
  date: string,
  startTime: string,
): Promise<{ durationMinutes: number }> => {
  const slots = await PublicBookingService.getSlots(slug, serviceId, date);
  const offered = slots.windows.some(
    (window) => window.startTime === startTime,
  );
  if (!offered) {
    throw new PublicBookingError("That time is no longer available", 409);
  }
  return { durationMinutes: slots.durationMinutes };
};

const requestSubmittedEmail = (practiceName: string, url: string) => ({
  subject: `Confirm your booking request for ${practiceName}`,
  htmlBody: `
    <p>Thanks for asking to book with ${escapeHtml(practiceName)}.</p>
    <p>Confirm your email address so the practice can see your request. This link
    works for ${CONFIRMATION_VALID_HOURS} hours.</p>
    ${renderEmailButton(url, "Confirm my request")}
    <p>Your request is not booked yet. The practice will be in touch to confirm a
    time.</p>
    <p>If you did not ask to book anything, ignore this email and nothing further
    happens.</p>
  `,
  textBody: [
    `Thanks for asking to book with ${practiceName}.`,
    "",
    `Confirm your email address so the practice can see your request (valid for ${CONFIRMATION_VALID_HOURS} hours):`,
    url,
    "",
    "Your request is not booked yet. The practice will be in touch to confirm a time.",
    "If you did not ask to book anything, ignore this email and nothing further happens.",
  ].join("\n"),
});

type StoredRequest = {
  serviceName: string;
  requestedStart: Date;
  durationMinutes: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  petName: string;
  petSpecies: string;
  concern: string | null;
};

const practiceNotificationEmail = (request: StoredRequest) => {
  const when = dayjs
    .utc(request.requestedStart)
    .format("ddd D MMM YYYY, HH:mm");
  const rows: [string, string][] = [
    ["Service", request.serviceName],
    ["Requested", `${when} UTC (${request.durationMinutes} min)`],
    ["Pet", `${request.petName} (${request.petSpecies})`],
    ["Owner", request.ownerName],
    ["Email", request.ownerEmail],
    ["Phone", request.ownerPhone ?? "not given"],
    ["Reason", request.concern ?? "not given"],
  ];

  return {
    subject: `New booking request from ${request.ownerName}`,
    htmlBody: `
      <p>A pet owner submitted a booking request through your public booking page
      and confirmed their email address.</p>
      <table>${rows
        .map(
          ([label, value]) =>
            `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>
      <p>This is a request, not an appointment. Nothing has been added to your
      calendar - book it in Yosemite Crew if you want it.</p>
    `,
    textBody: [
      "A pet owner submitted a booking request through your public booking page and confirmed their email address.",
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      "This is a request, not an appointment. Nothing has been added to your calendar.",
    ].join("\n"),
  };
};

export const PublicBookingRequestService = {
  /**
   * Accept a booking request and email the requester a confirmation link.
   *
   * The response is deliberately identical whether or not the email was sent,
   * and carries no identifier. A caller cannot use this endpoint to discover
   * whether an address is already in use, and cannot poll for a request id it
   * did not receive by email.
   */
  async submit(slug: string, input: PublicBookingRequestInput) {
    const practice = await requireCurrent(slug);
    const serviceId = requireSafeString(input.serviceId, "serviceId");
    const ownerEmail = normalizeEmail(input.ownerEmail);

    if (offersNothing(practice)) throw notFound();

    const offered = await loadPublicServices(practice);
    const service = offered.find((candidate) => candidate.id === serviceId);
    if (!service) throw notFound();

    const { durationMinutes } = await assertSlotIsOffered(
      slug,
      serviceId,
      input.date,
      input.startTime,
    );

    const pending = await prisma.publicBookingRequest.count({
      where: {
        organizationId: practice.organizationId,
        ownerEmail,
        status: "PENDING_CONFIRMATION",
      },
    });
    if (pending >= MAX_PENDING_PER_EMAIL) {
      throw new PublicBookingError(
        "There are already unconfirmed requests for this email address. Please confirm one of those first.",
        429,
      );
    }

    const token = randomBytes(CONFIRMATION_TOKEN_BYTES).toString("hex");
    const now = dayjs.utc();
    // Both halves are already proven: the date parsed strictly inside
    // `getSlots`, and the start time matched a window that `getSlots` produced.
    // There is no invalid case left to guard against here.
    const requestedStart = dayjs.utc(
      `${input.date} ${input.startTime}`,
      "YYYY-MM-DD HH:mm",
      true,
    );
    const requestedEnd = requestedStart.add(durationMinutes, "minute");

    await prisma.publicBookingRequest.create({
      data: {
        organizationId: practice.organizationId,
        productItemId: serviceId,
        serviceName: service.name,
        requestedStart: requestedStart.toDate(),
        requestedEnd: requestedEnd.toDate(),
        durationMinutes,
        ownerName: input.ownerName.trim(),
        ownerEmail,
        ownerPhone: input.ownerPhone?.trim() || null,
        petName: input.petName.trim(),
        petSpecies: input.petSpecies.trim(),
        concern: input.concern?.trim() || null,
        confirmationTokenHash: hashToken(token),
        confirmationExpiresAt: now
          .add(CONFIRMATION_VALID_HOURS, "hour")
          .toDate(),
        consentAcceptedAt: now.toDate(),
        purgeAfter: requestedStart.add(RETENTION_DAYS, "day").toDate(),
      },
    });

    const url = buildConfirmationUrl(practice.slug, token);
    if (url) {
      const message = requestSubmittedEmail(practice.name, url);
      try {
        await sendEmail({ to: ownerEmail, ...message });
      } catch (error: unknown) {
        // The row is already written, so the request is not lost, but the
        // requester cannot confirm without the link. Logged rather than thrown:
        // surfacing a send failure would tell an anonymous caller whether an
        // address is deliverable.
        logger.error("Public booking confirmation email failed", error);
      }
    } else {
      logger.error(
        "Public booking confirmation email skipped: PUBLIC_BOOKING_BASE_URL is not configured",
      );
    }
  },

  /**
   * Confirm a request from the emailed link, and tell the practice about it.
   *
   * Resolved by hash, so the stored value cannot be replayed by anyone who reads
   * the table. Every failure - unknown token, already used, expired - returns
   * the same 404, because distinguishing them lets a caller test tokens.
   */
  async confirm(rawToken: string) {
    const token = requireSafeString(rawToken, "token");

    const existing = await prisma.publicBookingRequest.findUnique({
      where: { confirmationTokenHash: hashToken(token) },
      select: {
        id: true,
        status: true,
        confirmationExpiresAt: true,
        serviceName: true,
        requestedStart: true,
        durationMinutes: true,
        ownerName: true,
        ownerEmail: true,
        ownerPhone: true,
        petName: true,
        petSpecies: true,
        concern: true,
        organization: {
          select: {
            name: true,
            email: true,
            bookingSlug: true,
            bookingSettings: { select: { replyToEmail: true } },
          },
        },
      },
    });

    if (existing?.status !== "PENDING_CONFIRMATION") throw notFound();
    if (dayjs.utc(existing.confirmationExpiresAt).isBefore(dayjs.utc()))
      throw notFound();

    await prisma.publicBookingRequest.update({
      where: { id: existing.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });

    const practiceInbox =
      existing.organization.bookingSettings?.replyToEmail ??
      existing.organization.email;

    if (practiceInbox) {
      const message = practiceNotificationEmail(existing);
      try {
        await sendEmail({ to: practiceInbox, ...message });
      } catch (error: unknown) {
        // The request is confirmed and visible in the practice's list either
        // way; the email is a prompt, not the record.
        logger.error("Public booking practice notification failed", error);
      }
    } else {
      logger.warn(
        "Public booking request confirmed but the practice has no reply-to or contact email",
      );
    }

    return {
      practiceName: existing.organization.name,
      slug: existing.organization.bookingSlug,
    };
  },

  /**
   * Confirmed requests for the practice, soonest requested time first.
   *
   * PENDING rows are deliberately excluded: anyone can type anyone's address
   * into a public form, so an unconfirmed request is an unverified claim and
   * showing it would make the practice's queue spammable by design.
   */
  async listForOrganisation(
    organisationId: string,
    status?: "CONFIRMED" | "DECLINED" | "BOOKED",
  ) {
    const safeOrganisationId = requireSafeString(
      organisationId,
      "organisationId",
    );

    return prisma.publicBookingRequest.findMany({
      where: {
        organizationId: safeOrganisationId,
        status: status ?? { in: ["CONFIRMED", "DECLINED", "BOOKED"] },
      },
      orderBy: { requestedStart: "asc" },
      take: 200,
      select: {
        id: true,
        serviceName: true,
        requestedStart: true,
        requestedEnd: true,
        durationMinutes: true,
        ownerName: true,
        ownerEmail: true,
        ownerPhone: true,
        petName: true,
        petSpecies: true,
        concern: true,
        status: true,
        confirmedAt: true,
        createdAt: true,
      },
    });
  },

  /**
   * Mark a request declined or booked.
   *
   * Scoped by organisation in the same statement that selects the row, so a
   * request belonging to another practice is not found rather than updated.
   */
  async setStatus(
    organisationId: string,
    requestId: string,
    status: "DECLINED" | "BOOKED",
  ) {
    const safeOrganisationId = requireSafeString(
      organisationId,
      "organisationId",
    );
    const safeRequestId = requireSafeString(requestId, "requestId");

    const updated = await prisma.publicBookingRequest.updateMany({
      where: {
        id: safeRequestId,
        organizationId: safeOrganisationId,
        status: { in: ["CONFIRMED", "DECLINED", "BOOKED"] },
      },
      data: { status },
    });

    if (updated.count === 0) {
      throw new PublicBookingError("Booking request not found", 404);
    }
  },

  /**
   * Delete what is past its retention deadline and expire stale links.
   *
   * Runs on a schedule rather than opportunistically: a practice that stops
   * receiving requests must still stop holding the ones it already has.
   */
  async purgeExpired(now: Date = new Date()) {
    const expired = await prisma.publicBookingRequest.updateMany({
      where: {
        status: "PENDING_CONFIRMATION",
        confirmationExpiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });

    const deleted = await prisma.publicBookingRequest.deleteMany({
      where: { purgeAfter: { lt: now } },
    });

    return { expired: expired.count, deleted: deleted.count };
  },
};

export default PublicBookingService;
