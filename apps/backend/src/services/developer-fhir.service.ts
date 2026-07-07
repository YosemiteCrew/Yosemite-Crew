import type {
  Appointment as FHIRAppointment,
  CapabilityStatement,
  Encounter as FHIREncounter,
  Invoice as FHIRInvoice,
  Organization as FHIROrganization,
  Patient as FHIRPatient,
} from "@yosemite-crew/fhir";
import {
  toFHIRAppointment,
  toFHIRCompanion,
  toFHIREncounter,
  toFHIRInvoice,
  toFHIROrganisation,
  type Appointment as DomainAppointment,
  type Companion,
  type Encounter as DomainEncounter,
  type Invoice as DomainInvoice,
  type InvoiceItem,
  type Organisation,
} from "@yosemite-crew/types";
import {
  DeveloperDataService,
  type AppointmentStatusFilter,
  type InvoiceStatusFilter,
  type PatientStatusFilter,
} from "src/services/developer-data.service";
import type { ListPagination } from "src/utils/cursor-pagination";

// FHIR R4 dialect of the developer data plane (plan:
// docs/plans/developer-portal-fhir-api.md). Every query is the SAME
// org-scoped, keyset-paginated DeveloperDataService query the JSON API runs;
// this service only adapts the Prisma row shapes into the packages/types
// domain shapes and maps them through the REAL converters. No mapping is
// reinvented here - the converters own the FHIR projection.
//
// CONFORMANCE GAPS (known, shipped as the converters emit - documented per
// the design doc; fixing them means fixing the converter for every caller,
// not forking a copy here):
// - toFHIRCompanion emits `Patient.animal`, an element removed in R4 (design
//   doc section 2: conformant output needs the `patient-animal` extension).
// - Identifier/code systems use placeholder URIs (example.org microchip /
//   passport / tax-id systems, example.org appointment-types).
// - toFHIRAppointment passes platform status enums (UPCOMING, CHECKED_IN,
//   ...) straight into Appointment.status, which R4 restricts to its own
//   value set. FHIR-native status aliases are Phase B.
// - toFHIRAppointment requires a patient participant with parent linkage;
//   the Appointment.patient JSON snapshot may lack species/parent, in which
//   case the converter emits participants with empty-string references.
// - toFHIRInvoice always emits `recipient` / an appointment-id extension,
//   so a row without parentId/appointmentId yields "RelatedPerson/undefined"
//   references.
// - Organisation has no email/rating fields, so the JSON API's email,
//   averageRating and ratingCount have no FHIR projection.
// - Invoice SEARCH entries carry no lineItem detail because the JSON list
//   select excludes `items` (parity: both dialects serve the same rows);
//   the read interaction includes them.

type FhirPage<T> = { resources: T[]; pagination: ListPagination };

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null ? (value as JsonRecord) : {};

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

// --- Appointment -----------------------------------------------------------

type AppointmentRow = {
  id: string;
  organisationId: string;
  patient: unknown;
  lead: unknown;
  appointmentType: unknown;
  room: unknown;
  appointmentDate: Date;
  startTime: Date;
  endTime: Date;
  timeSlot: string;
  durationMinutes: number;
  status: string;
  isEmergency: boolean;
  concern: string | null;
  supportStaff?: unknown;
  attachments?: unknown;
  formIds?: string[];
  caseId?: string | null;
  encounterId?: string | null;
  appointmentKind?: string | null;
};

// The patient/lead/appointmentType/room columns are JSON snapshots written at
// booking time (data API contract 5.4) - their inner shape is best-effort.
const adaptAppointmentRow = (row: AppointmentRow): DomainAppointment => {
  const patient = asRecord(row.patient);
  const parent = asRecord(patient.parent);
  const lead = asRecord(row.lead);
  const appointmentType = asRecord(row.appointmentType);
  const speciality = asRecord(appointmentType.speciality);
  const room = asRecord(row.room);

  const domain: DomainAppointment = {
    id: row.id,
    organisationId: row.organisationId,
    caseId: row.caseId ?? undefined,
    encounterId: row.encounterId ?? undefined,
    patient: {
      id: asString(patient.id),
      name: asString(patient.name),
      species: asString(patient.species ?? patient.type),
      breed: asOptionalString(patient.breed),
      parent: { id: asString(parent.id), name: asString(parent.name) },
    },
    lead: asOptionalString(lead.id)
      ? {
          id: asString(lead.id),
          name: asString(lead.name),
          profileUrl: asOptionalString(lead.profileUrl),
        }
      : undefined,
    appointmentType: asOptionalString(appointmentType.id)
      ? {
          id: asString(appointmentType.id),
          name: asString(appointmentType.name),
          // The snapshot may omit speciality; the converter handles the
          // missing branch at runtime even though the type declares it.
          speciality: asOptionalString(speciality.id)
            ? { id: asString(speciality.id), name: asString(speciality.name) }
            : (undefined as unknown as { id: string; name: string }),
        }
      : undefined,
    room: asOptionalString(room.id)
      ? {
          id: asString(room.id),
          name: asString(room.name),
          unitId: asOptionalString(room.unitId),
          unitName: asOptionalString(room.unitName),
        }
      : undefined,
    appointmentKind:
      (row.appointmentKind as DomainAppointment["appointmentKind"]) ??
      undefined,
    appointmentDate: row.appointmentDate,
    startTime: row.startTime,
    endTime: row.endTime,
    timeSlot: row.timeSlot,
    durationMinutes: row.durationMinutes,
    status: row.status as DomainAppointment["status"],
    isEmergency: row.isEmergency,
    concern: row.concern ?? undefined,
    formIds: row.formIds,
  };

  if (Array.isArray(row.supportStaff)) {
    domain.supportStaff = row.supportStaff
      .map((staff) => asRecord(staff))
      .filter((staff) => asOptionalString(staff.id))
      .map((staff) => ({
        id: asString(staff.id),
        name: asString(staff.name),
      }));
  }
  if (Array.isArray(row.attachments)) {
    domain.attachments = row.attachments.map((attachment) => {
      const record = asRecord(attachment);
      return {
        key: asOptionalString(record.key),
        name: asOptionalString(record.name),
        contentType: asOptionalString(record.contentType),
      };
    });
  }
  return domain;
};

// --- Patient ---------------------------------------------------------------

type PatientRow = {
  id: string;
  name: string;
  type: string;
  breed: string;
  dateOfBirth: Date;
  gender: string;
  photoUrl: string | null;
  status: string | null;
  isInsured: boolean;
  microchipNumber: string | null;
  updatedAt: Date;
  speciesCode?: string | null;
  breedCode?: string | null;
  currentWeight?: number | null;
  colour?: string | null;
  allergy?: string | null;
  isNeutered?: boolean | null;
  passportNumber?: string | null;
};

const adaptPatientRow = (row: PatientRow): Companion => ({
  id: row.id,
  name: row.name,
  type: row.type as Companion["type"],
  breed: row.breed,
  speciesCode: row.speciesCode ?? undefined,
  breedCode: row.breedCode ?? undefined,
  dateOfBirth: row.dateOfBirth,
  gender: row.gender as Companion["gender"],
  photoUrl: row.photoUrl ?? undefined,
  currentWeight: row.currentWeight ?? undefined,
  colour: row.colour ?? undefined,
  allergy: row.allergy ?? undefined,
  isneutered: row.isNeutered ?? undefined,
  microchipNumber: row.microchipNumber ?? undefined,
  passportNumber: row.passportNumber ?? undefined,
  isInsured: row.isInsured,
  status: (row.status as Companion["status"]) ?? undefined,
  updatedAt: row.updatedAt,
});

// --- Encounter --------------------------------------------------------------

type EncounterRow = {
  id: string;
  caseId: string;
  organisationId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  encounterClass: string;
  appointmentKind: string;
  title: string | null;
  reason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
};

const adaptEncounterRow = (row: EncounterRow): DomainEncounter => ({
  id: row.id,
  caseId: row.caseId,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as DomainEncounter["status"],
  encounterClass: row.encounterClass as DomainEncounter["encounterClass"],
  appointmentKind: row.appointmentKind as DomainEncounter["appointmentKind"],
  title: row.title ?? undefined,
  reason: row.reason ?? undefined,
  periodStart: row.periodStart ?? undefined,
  periodEnd: row.periodEnd ?? undefined,
});

// --- Invoice ----------------------------------------------------------------

type InvoiceRow = {
  id: string;
  organisationId: string | null;
  patientId: string | null;
  parentId: string | null;
  appointmentId: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  currency: string;
  status: string;
  visitBillingStage: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: unknown;
  taxPercent?: number | null;
  depositTargetAmount?: number | null;
  depositCollectedAmount?: number | null;
  paymentCollectionMethod?: string | null;
  billingCollectionMode?: string | null;
};

const adaptInvoiceRow = (row: InvoiceRow): DomainInvoice => ({
  id: row.id,
  organisationId: row.organisationId ?? undefined,
  patientId: row.patientId ?? undefined,
  parentId: row.parentId ?? undefined,
  appointmentId: row.appointmentId ?? undefined,
  items: Array.isArray(row.items) ? (row.items as InvoiceItem[]) : [],
  subtotal: row.subtotal,
  taxPercent: row.taxPercent ?? undefined,
  totalAmount: row.totalAmount,
  discountTotal: row.discountTotal,
  taxTotal: row.taxTotal,
  depositTargetAmount: row.depositTargetAmount ?? undefined,
  depositCollectedAmount: row.depositCollectedAmount ?? undefined,
  // Absent on list rows (list select excludes it); the converter skips the
  // extension when undefined, the domain type just declares it required.
  paymentCollectionMethod: (row.paymentCollectionMethod ??
    undefined) as DomainInvoice["paymentCollectionMethod"],
  billingCollectionMode:
    (row.billingCollectionMode as DomainInvoice["billingCollectionMode"]) ??
    undefined,
  visitBillingStage:
    (row.visitBillingStage as DomainInvoice["visitBillingStage"]) ?? undefined,
  currency: row.currency,
  status: row.status as DomainInvoice["status"],
  paidAt: row.paidAt ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// --- Organization -----------------------------------------------------------

type OrganizationRow = {
  id: string;
  name: string;
  type: string;
  phoneNo: string;
  website: string | null;
  imageUrl: string | null;
  isVerified: boolean;
  isActive: boolean;
  petNamePreference: string | null;
  address: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

// taxId is deliberately empty: the data-plane select never fetches it
// (contract 3.5 exclusion list), and the converter skips the identifier and
// extension for a falsy value. Same for the cert numbers, googlePlacesId and
// stripeAccountId - they are simply never present on the domain object here.
const adaptOrganizationRow = (row: OrganizationRow): Organisation => ({
  _id: row.id,
  name: row.name,
  type: row.type as Organisation["type"],
  phoneNo: row.phoneNo,
  website: row.website ?? undefined,
  imageURL: row.imageUrl ?? undefined,
  isVerified: row.isVerified,
  isActive: row.isActive,
  petNamePreference:
    (row.petNamePreference as Organisation["petNamePreference"]) ?? undefined,
  taxId: "",
  address: row.address
    ? {
        addressLine: row.address.addressLine ?? undefined,
        city: row.address.city ?? undefined,
        state: row.address.state ?? undefined,
        postalCode: row.address.postalCode ?? undefined,
        country: row.address.country ?? undefined,
        latitude: row.address.latitude ?? undefined,
        longitude: row.address.longitude ?? undefined,
      }
    : undefined,
});

// --- Capability statement ----------------------------------------------------

const SEARCH_PARAM_DEFINITIONS = {
  count: {
    name: "_count",
    type: "number",
    documentation: "Page size (1-100, default 50).",
  },
  cursor: {
    name: "_cursor",
    type: "string",
    documentation:
      "Opaque continuation token from the previous page's next link. Clients must not parse it.",
  },
  date: {
    name: "date",
    type: "date",
    documentation: "Date range with ge/le prefixes.",
  },
  status: {
    name: "status",
    type: "token",
    documentation: "Platform status enum value (see resource documentation).",
  },
  patient: {
    name: "patient",
    type: "reference",
    documentation: "Patient reference (Patient/{id} or {id}).",
  },
  active: {
    name: "active",
    type: "token",
    documentation: "true maps to active records, false to archived records.",
  },
} as const;

type SearchParamKey = keyof typeof SEARCH_PARAM_DEFINITIONS;

const CAPABILITY_RESOURCES: Array<{
  type: string;
  params: SearchParamKey[];
}> = [
  { type: "Organization", params: [] },
  { type: "Patient", params: ["active", "count", "cursor"] },
  {
    type: "Appointment",
    params: ["date", "status", "count", "cursor"],
  },
  {
    type: "Encounter",
    params: ["status", "patient", "date", "count", "cursor"],
  },
  {
    type: "Invoice",
    params: ["status", "patient", "date", "count", "cursor"],
  },
];

export const DeveloperFhirService = {
  buildCapabilityStatement(): CapabilityStatement {
    return {
      resourceType: "CapabilityStatement",
      status: "active",
      date: "2026-07-07",
      kind: "instance",
      fhirVersion: "4.0.1",
      format: ["application/fhir+json"],
      publisher: "Yosemite Crew",
      software: { name: "Yosemite Crew Developer Data Plane" },
      implementation: {
        description:
          "Read-only FHIR R4 projection of the org-scoped developer data API. Authenticated by developer API keys; scopes and rate limits are shared with the JSON dialect.",
      },
      rest: [
        {
          mode: "server",
          documentation:
            "Search responses are searchset Bundles paginated by opaque _cursor tokens carried in the next link. Errors are OperationOutcome resources preserving the JSON API's machine code in issue[0].details.coding[0].code.",
          resource: CAPABILITY_RESOURCES.map((resource) => ({
            type: resource.type,
            interaction: [{ code: "read" }, { code: "search-type" }],
            searchParam: resource.params.map(
              (param) => SEARCH_PARAM_DEFINITIONS[param],
            ),
          })),
        },
      ],
    };
  },

  async listAppointments(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
    status?: AppointmentStatusFilter;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<FhirPage<FHIRAppointment>> {
    const page = await DeveloperDataService.listAppointments(input);
    return {
      resources: page.items.map((row) =>
        toFHIRAppointment(adaptAppointmentRow(row as AppointmentRow)),
      ),
      pagination: page.pagination,
    };
  },

  async getAppointment(
    organisationId: string,
    id: string,
  ): Promise<FHIRAppointment | null> {
    const row = await DeveloperDataService.getAppointment(organisationId, id);
    return row
      ? toFHIRAppointment(adaptAppointmentRow(row as AppointmentRow))
      : null;
  },

  async listPatients(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
    status?: PatientStatusFilter;
  }): Promise<FhirPage<FHIRPatient>> {
    const page = await DeveloperDataService.listPatients(input);
    return {
      resources: page.items.map((row) =>
        toFHIRCompanion(adaptPatientRow(row as PatientRow)),
      ),
      pagination: page.pagination,
    };
  },

  async getPatient(
    organisationId: string,
    id: string,
  ): Promise<FHIRPatient | null> {
    const row = await DeveloperDataService.getPatient(organisationId, id);
    return row ? toFHIRCompanion(adaptPatientRow(row as PatientRow)) : null;
  },

  async listEncounters(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
    status?: string;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<FhirPage<FHIREncounter>> {
    const page = await DeveloperDataService.listEncounters(input);
    return {
      resources: page.items.map((row) =>
        toFHIREncounter(adaptEncounterRow(row as EncounterRow)),
      ),
      pagination: page.pagination,
    };
  },

  async getEncounter(
    organisationId: string,
    id: string,
  ): Promise<FHIREncounter | null> {
    const row = await DeveloperDataService.getEncounter(organisationId, id);
    return row ? toFHIREncounter(adaptEncounterRow(row as EncounterRow)) : null;
  },

  async listInvoices(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
    status?: InvoiceStatusFilter;
    patientId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<FhirPage<FHIRInvoice>> {
    const page = await DeveloperDataService.listInvoices(input);
    return {
      resources: page.items.map((row) =>
        toFHIRInvoice(adaptInvoiceRow(row as InvoiceRow)),
      ),
      pagination: page.pagination,
    };
  },

  async getInvoice(
    organisationId: string,
    id: string,
  ): Promise<FHIRInvoice | null> {
    const row = await DeveloperDataService.getInvoice(organisationId, id);
    return row ? toFHIRInvoice(adaptInvoiceRow(row as InvoiceRow)) : null;
  },

  async getOrganization(
    organisationId: string,
  ): Promise<FHIROrganization | null> {
    const row = await DeveloperDataService.getOrganization(organisationId);
    return row
      ? toFHIROrganisation(adaptOrganizationRow(row as OrganizationRow))
      : null;
  },
};
