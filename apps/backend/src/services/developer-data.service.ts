import type { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  buildListPage,
  keysetWhere,
  type ListPage,
} from "src/utils/cursor-pagination";

// Data access for the Developer Data API v1 (contract:
// docs/plans/developer-portal-data-api.md). Read-only, org-scoped by the
// verified API key: every query filters on the key's organisationId, and
// detail lookups return null for rows that are absent OR owned by another org
// so callers can 404 without an existence leak. Field selects below are the
// contract - do not widen them.

export type AppointmentStatusFilter =
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type PatientStatusFilter = "active" | "archived" | "inactive";

export type InvoiceStatusFilter =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

type ListInput = {
  organisationId: string;
  limit: number;
  cursor?: string;
};

const dateRangeFilter = (
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined => {
  if (!dateFrom && !dateTo) {
    return undefined;
  }
  return {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
};

// AND-merges the keyset continuation predicate into the org-scoped filter, so
// a presented cursor can only ever partition the caller's own rows: a forged
// token yields indistinguishable results whether its embedded id lives in
// another org or nowhere at all.
const withKeyset = <W extends object>(
  where: W,
  sortField: string,
  cursor?: string,
): W => {
  const keyset = keysetWhere(sortField, cursor);
  return keyset ? { ...where, AND: [keyset] } : where;
};

const APPOINTMENT_LIST_SELECT = {
  id: true,
  organisationId: true,
  patient: true,
  lead: true,
  appointmentType: true,
  room: true,
  appointmentDate: true,
  startTime: true,
  endTime: true,
  timeSlot: true,
  durationMinutes: true,
  status: true,
  isEmergency: true,
  concern: true,
  createdAt: true,
  updatedAt: true,
} as const;

const APPOINTMENT_DETAIL_SELECT = {
  ...APPOINTMENT_LIST_SELECT,
  supportStaff: true,
  attachments: true,
  formIds: true,
  caseId: true,
  encounterId: true,
  appointmentKind: true,
} as const;

const PATIENT_LIST_SELECT = {
  id: true,
  name: true,
  type: true,
  breed: true,
  dateOfBirth: true,
  gender: true,
  photoUrl: true,
  status: true,
  isInsured: true,
  microchipNumber: true,
  createdAt: true,
  updatedAt: true,
} as const;

const PATIENT_DETAIL_SELECT = {
  ...PATIENT_LIST_SELECT,
  speciesCode: true,
  breedCode: true,
  currentWeight: true,
  colour: true,
  allergy: true,
  isNeutered: true,
  passportNumber: true,
} as const;

const ENCOUNTER_SELECT = {
  id: true,
  caseId: true,
  organisationId: true,
  patientId: true,
  parentId: true,
  status: true,
  encounterClass: true,
  appointmentKind: true,
  title: true,
  reason: true,
  periodStart: true,
  periodEnd: true,
  createdAt: true,
  updatedAt: true,
} as const;

const INVOICE_LIST_SELECT = {
  id: true,
  organisationId: true,
  patientId: true,
  parentId: true,
  appointmentId: true,
  subtotal: true,
  discountTotal: true,
  taxTotal: true,
  totalAmount: true,
  currency: true,
  status: true,
  visitBillingStage: true,
  paidAt: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Never exposed: metadata and Stripe/PSP internals (contract 3.4).
const INVOICE_DETAIL_SELECT = {
  ...INVOICE_LIST_SELECT,
  items: true,
  invoiceDiscountType: true,
  invoiceDiscountValue: true,
  invoiceDiscountTotal: true,
  taxPercent: true,
  depositTargetAmount: true,
  depositCollectedAmount: true,
  paymentCollectionMethod: true,
  billingCollectionMode: true,
} as const;

// Never exposed: documensoApiKey/TeamId, stripeAccountId, googlePlacesId,
// taxId, dunsNumber, compliance certificate numbers (contract 3.5).
const ORGANIZATION_SELECT = {
  id: true,
  name: true,
  type: true,
  email: true,
  phoneNo: true,
  website: true,
  imageUrl: true,
  isVerified: true,
  isActive: true,
  petNamePreference: true,
  averageRating: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
  address: {
    select: {
      addressLine: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      latitude: true,
      longitude: true,
    },
  },
} as const;

export const DeveloperDataService = {
  async listAppointments(
    input: ListInput & {
      status?: AppointmentStatusFilter;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const appointmentDate = dateRangeFilter(input.dateFrom, input.dateTo);
    const where: Prisma.AppointmentWhereInput = {
      organisationId: input.organisationId,
      ...(input.status ? { status: input.status } : {}),
      ...(appointmentDate ? { appointmentDate } : {}),
    };
    const rows = await prisma.appointment.findMany({
      where: withKeyset(where, "appointmentDate", input.cursor),
      select: APPOINTMENT_LIST_SELECT,
      orderBy: [{ appointmentDate: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "appointmentDate");
  },

  async getAppointment(organisationId: string, id: string) {
    return prisma.appointment.findFirst({
      where: { id, organisationId },
      select: APPOINTMENT_DETAIL_SELECT,
    });
  },

  // Patients are shared across orgs; the ACTIVE PatientOrganisation link is
  // the org-scoping boundary. The status filter is pushed into the Prisma
  // where clause so cursor pagination stays correct (contract 3.2).
  async listPatients(
    input: ListInput & { status?: PatientStatusFilter },
  ): Promise<ListPage<unknown>> {
    const where: Prisma.PatientOrganisationWhereInput = {
      organisationId: input.organisationId,
      status: "ACTIVE",
      ...(input.status ? { patient: { status: input.status } } : {}),
    };
    const links = await prisma.patientOrganisation.findMany({
      where: withKeyset(where, "createdAt", input.cursor),
      select: {
        id: true,
        createdAt: true,
        patient: { select: PATIENT_LIST_SELECT },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    // The delegate's return type does not carry the select payload here, so
    // pin the row shape the select above actually produces.
    type PatientLinkRow = { id: string; createdAt: Date; patient: unknown };
    const page = buildListPage(
      links as PatientLinkRow[],
      input.limit,
      "createdAt",
    );
    return {
      items: page.items.map((link) => link.patient),
      pagination: page.pagination,
    };
  },

  async getPatient(organisationId: string, patientId: string) {
    const link = await prisma.patientOrganisation.findFirst({
      where: { patientId, organisationId, status: "ACTIVE" },
      select: { patient: { select: PATIENT_DETAIL_SELECT } },
    });
    return link?.patient ?? null;
  },

  async listEncounters(
    input: ListInput & {
      status?: string;
      patientId?: string;
      caseId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const periodStart = dateRangeFilter(input.dateFrom, input.dateTo);
    const where: Prisma.EncounterWhereInput = {
      organisationId: input.organisationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.patientId ? { patientId: input.patientId } : {}),
      ...(input.caseId ? { caseId: input.caseId } : {}),
      ...(periodStart ? { periodStart } : {}),
    };
    const rows = await prisma.encounter.findMany({
      where: withKeyset(where, "createdAt", input.cursor),
      select: ENCOUNTER_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "createdAt");
  },

  async getEncounter(organisationId: string, id: string) {
    return prisma.encounter.findFirst({
      where: { id, organisationId },
      select: ENCOUNTER_SELECT,
    });
  },

  async listInvoices(
    input: ListInput & {
      status?: InvoiceStatusFilter;
      patientId?: string;
      appointmentId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const createdAt = dateRangeFilter(input.dateFrom, input.dateTo);
    // Equality on the key's org naturally excludes rows with a null org.
    const where: Prisma.InvoiceWhereInput = {
      organisationId: input.organisationId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.patientId ? { patientId: input.patientId } : {}),
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const rows = await prisma.invoice.findMany({
      where: withKeyset(where, "createdAt", input.cursor),
      select: INVOICE_LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "createdAt");
  },

  async getInvoice(organisationId: string, id: string) {
    return prisma.invoice.findFirst({
      where: { id, organisationId },
      select: INVOICE_DETAIL_SELECT,
    });
  },

  async getOrganization(organisationId: string) {
    return prisma.organization.findUnique({
      where: { id: organisationId },
      select: ORGANIZATION_SELECT,
    });
  },
};
