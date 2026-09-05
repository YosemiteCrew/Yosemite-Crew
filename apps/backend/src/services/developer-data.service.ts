/*
 * Read models for the developer data plane (`/v1/developer`).
 *
 * Every org-scoped query here takes `organisationId` as an argument and the
 * caller MUST pass the value `withOrgPermissions()` resolved onto the request,
 * never a value read straight from the client. That middleware only writes
 * `req.organisationId` after matching the caller against a live
 * `active: true` UserOrganization row, which is what makes these queries safe;
 * a raw `x-org-id` would not be.
 */
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  clampPageSize as clampToBounds,
  splitPage,
} from "src/services/shared/pagination";

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

/*
 * A membership row stores either a bare organisation id or a FHIR-style
 * `Organization/<id>` reference, and both forms are live in the table - the
 * `OR` in `withOrgPermissions()` exists for exactly this reason. Normalising on
 * read keeps that detail out of every caller.
 */
const ORGANIZATION_REFERENCE_PREFIX = "Organization/";

export const normaliseOrganisationReference = (reference: string): string =>
  reference.startsWith(ORGANIZATION_REFERENCE_PREFIX)
    ? reference.slice(ORGANIZATION_REFERENCE_PREFIX.length)
    : reference;

/*
 * This surface's bounds, applied by the shared clamp. The rule itself lives in
 * `shared/pagination` because the owner prescription list needs the identical
 * decision with different numbers (#2709).
 */
export const clampPageSize = (raw: unknown): number =>
  clampToBounds(raw, {
    defaultSize: DEFAULT_PAGE_SIZE,
    maxSize: MAX_PAGE_SIZE,
  });

export interface OrganizationSummary {
  id: string;
  name: string;
  type: string;
  roleCode: string;
  roleDisplay: string | null;
}

export interface AppointmentQuery {
  organisationId: string;
  limit: number;
  cursor?: string;
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const APPOINTMENT_FIELDS = {
  id: true,
  organisationId: true,
  patient: true,
  lead: true,
  appointmentType: true,
  room: true,
  appointmentKind: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  timeSlot: true,
  durationMinutes: true,
  status: true,
  isEmergency: true,
  concern: true,
  caseId: true,
  encounterId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppointmentSelect;

export const DeveloperDataService = {
  /*
   * The practices this developer may act for. This is the discovery endpoint:
   * every other org-scoped route needs an `x-org-id`, and without this a key
   * holder has no way to learn a valid one except by guessing.
   *
   * Deliberately not org-gated - it reads the caller's OWN memberships, and
   * filters on `active: true` so an offboarded holder sees an empty list rather
   * than a practice they can no longer reach.
   */
  async listOrganizations(ownerUserId: string): Promise<OrganizationSummary[]> {
    const memberships = await prisma.userOrganization.findMany({
      where: { practitionerReference: ownerUserId, active: true },
      select: {
        organizationReference: true,
        roleCode: true,
        roleDisplay: true,
      },
    });

    if (memberships.length === 0) {
      return [];
    }

    const byId = new Map(
      memberships.map((membership) => [
        normaliseOrganisationReference(membership.organizationReference),
        membership,
      ]),
    );

    const organizations = await prisma.organization.findMany({
      where: { id: { in: Array.from(byId.keys()) } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    return organizations.flatMap((organization) => {
      const membership = byId.get(organization.id);
      if (!membership) {
        return [];
      }
      return [
        {
          id: organization.id,
          name: organization.name,
          type: organization.type,
          roleCode: membership.roleCode,
          roleDisplay: membership.roleDisplay,
        },
      ];
    });
  },

  /*
   * Keyset pagination via Prisma's `cursor`, ordered by `(appointmentDate, id)`.
   * The id tiebreak is not decoration: several appointments share a date, and
   * without it the order is unstable and a page boundary can drop or repeat a
   * row. `skip: 1` steps past the cursor row itself.
   */
  async listAppointments(query: AppointmentQuery): Promise<Page<unknown>> {
    const where: Prisma.AppointmentWhereInput = {
      organisationId: query.organisationId,
    };

    if (query.from || query.to) {
      where.appointmentDate = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    if (query.status) {
      where.status = query.status;
    }

    const rows = await prisma.appointment.findMany({
      where,
      select: APPOINTMENT_FIELDS,
      orderBy: [{ appointmentDate: "asc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const { items, nextCursor } = splitPage(rows, query.limit);

    return { items, nextCursor };
  },

  /*
   * The organisation is resolved from the appointment itself by
   * `withAppointmentOrgPermissions()` before this runs, so the row is already
   * known to belong to a practice the caller is an active member of. The
   * `organisationId` filter here is redundant against that middleware and kept
   * on purpose: it makes the query safe on its own terms, so a future route
   * that composes the middleware differently cannot turn this into an IDOR.
   */
  async getAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<unknown> {
    return prisma.appointment.findFirst({
      where: { id: appointmentId, organisationId },
      select: APPOINTMENT_FIELDS,
    });
  },
};
