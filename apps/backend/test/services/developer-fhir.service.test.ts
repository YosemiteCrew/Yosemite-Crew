import { DeveloperFhirService } from "../../src/services/developer-fhir.service";
import { DeveloperDataService } from "../../src/services/developer-data.service";

// The adapters are exercised against the REAL converters from
// @yosemite-crew/types (they are pure functions); only the Prisma-backed
// data service is mocked.
jest.mock("src/services/developer-data.service", () => ({
  DeveloperDataService: {
    listAppointments: jest.fn(),
    getAppointment: jest.fn(),
    listPatients: jest.fn(),
    getPatient: jest.fn(),
    listEncounters: jest.fn(),
    getEncounter: jest.fn(),
    listInvoices: jest.fn(),
    getInvoice: jest.fn(),
    getOrganization: jest.fn(),
  },
}));

const mockData = DeveloperDataService as unknown as Record<string, jest.Mock>;

const pagination = { nextCursor: "cur-1", hasMore: true, limit: 50 };

const appointmentRow = {
  id: "apt-1",
  organisationId: "org-1",
  patient: {
    id: "pat-1",
    name: "Biscuit",
    species: "dog",
    breed: "Beagle",
    parent: { id: "parent-1", name: "Jane" },
  },
  lead: { id: "lead-1", name: "Dr. Vet" },
  appointmentType: {
    id: "type-1",
    name: "Consultation",
    speciality: { id: "spec-1", name: "General" },
  },
  room: null,
  appointmentDate: new Date("2026-07-09T00:00:00.000Z"),
  startTime: new Date("2026-07-09T09:30:00.000Z"),
  endTime: new Date("2026-07-09T10:00:00.000Z"),
  timeSlot: "09:30",
  durationMinutes: 30,
  status: "UPCOMING",
  isEmergency: false,
  concern: "Limping",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const patientRow = {
  id: "pat-1",
  name: "Biscuit",
  type: "dog",
  breed: "Beagle",
  dateOfBirth: new Date("2020-01-15T00:00:00.000Z"),
  gender: "male",
  photoUrl: null,
  status: "active",
  isInsured: true,
  microchipNumber: "chip-123",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
};

const encounterRow = {
  id: "enc-1",
  caseId: "case-1",
  organisationId: "org-1",
  patientId: "pat-1",
  parentId: null,
  status: "in-progress",
  encounterClass: "AMB",
  appointmentKind: "OUTPATIENT",
  title: "Checkup",
  reason: "Annual",
  periodStart: new Date("2026-07-01T10:00:00.000Z"),
  periodEnd: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
};

const invoiceDetailRow = {
  id: "inv-1",
  organisationId: "org-1",
  patientId: "pat-1",
  parentId: "parent-1",
  appointmentId: "apt-1",
  subtotal: 100,
  discountTotal: 10,
  taxTotal: 5,
  totalAmount: 95,
  currency: "USD",
  status: "PAID",
  visitBillingStage: "SETTLED",
  paidAt: new Date("2026-07-02T00:00:00.000Z"),
  finalizedAt: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-02T00:00:00.000Z"),
  items: [
    { id: "item-1", name: "Consult", quantity: 1, unitPrice: 100, total: 100 },
  ],
  taxPercent: 5,
  depositTargetAmount: 0,
  depositCollectedAmount: 0,
  paymentCollectionMethod: "PAYMENT_AT_CLINIC",
  billingCollectionMode: "PAY_AT_VISIT_END",
};

const organizationRow = {
  id: "org-1",
  name: "Happy Paws",
  type: "HOSPITAL",
  email: "clinic@example.com",
  phoneNo: "+15550001111",
  website: "https://happypaws.example.com",
  imageUrl: null,
  isVerified: true,
  isActive: true,
  petNamePreference: "PATIENT",
  averageRating: 4.5,
  ratingCount: 12,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  address: {
    addressLine: "1 Main St",
    city: "Springfield",
    state: "CA",
    postalCode: "90001",
    country: "US",
    latitude: 34.05,
    longitude: -118.24,
  },
};

describe("DeveloperFhirService.buildCapabilityStatement", () => {
  it("declares the v1 resource set with read + search-type", () => {
    const capability = DeveloperFhirService.buildCapabilityStatement();
    expect(capability.resourceType).toBe("CapabilityStatement");
    expect(capability.kind).toBe("instance");
    expect(capability.fhirVersion).toBe("4.0.1");
    expect(capability.format).toEqual(["application/fhir+json"]);
    const resources = capability.rest?.[0]?.resource ?? [];
    expect(resources.map((entry) => entry.type)).toEqual([
      "Organization",
      "Patient",
      "Appointment",
      "Encounter",
      "Invoice",
    ]);
    for (const resource of resources) {
      expect(resource.interaction).toEqual([
        { code: "read" },
        { code: "search-type" },
      ]);
    }
    const appointment = resources.find((entry) => entry.type === "Appointment");
    expect(appointment?.searchParam?.map((param) => param.name)).toEqual([
      "date",
      "status",
      "_count",
      "_cursor",
    ]);
  });
});

describe("DeveloperFhirService appointments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps list rows through toFHIRAppointment and passes pagination through", async () => {
    mockData.listAppointments.mockResolvedValue({
      items: [appointmentRow],
      pagination,
    });
    const page = await DeveloperFhirService.listAppointments({
      organisationId: "org-1",
      limit: 50,
      status: "UPCOMING",
    });

    expect(mockData.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ organisationId: "org-1", status: "UPCOMING" }),
    );
    expect(page.pagination).toBe(pagination);
    const resource = page.resources[0];
    expect(resource.resourceType).toBe("Appointment");
    expect(resource.id).toBe("apt-1");
    expect(resource.status).toBe("UPCOMING");
    expect(resource.start).toBe("2026-07-09T09:30:00.000Z");
    expect(resource.minutesDuration).toBe(30);
    const refs = resource.participant.map((p) => p.actor?.reference);
    expect(refs).toContain("Patient/pat-1");
    expect(refs).toContain("RelatedPerson/parent-1");
    expect(refs).toContain("Organization/org-1");
    expect(refs).toContain("Practitioner/lead-1");
  });

  it("adapts loose JSON snapshots without species or parent", async () => {
    mockData.listAppointments.mockResolvedValue({
      items: [
        {
          ...appointmentRow,
          patient: { id: "pat-2", name: "Rex" },
          lead: null,
          appointmentType: { id: "type-1", name: "Consultation" },
        },
      ],
      pagination,
    });
    const page = await DeveloperFhirService.listAppointments({
      organisationId: "org-1",
      limit: 50,
    });
    const resource = page.resources[0];
    expect(resource.resourceType).toBe("Appointment");
    // No lead participant when the snapshot has no lead id.
    expect(
      resource.participant.some((p) =>
        p.actor?.reference?.startsWith("Practitioner/"),
      ),
    ).toBe(false);
    // Missing speciality yields no specialty coding, not a crash.
    expect(resource.specialty).toEqual([]);
  });

  it("read returns null passthrough and maps detail rows", async () => {
    mockData.getAppointment.mockResolvedValue(null);
    await expect(
      DeveloperFhirService.getAppointment("org-1", "missing"),
    ).resolves.toBeNull();

    mockData.getAppointment.mockResolvedValue({
      ...appointmentRow,
      supportStaff: [{ id: "staff-1", name: "Tech" }],
      attachments: [{ key: "k", name: "n", contentType: "image/png" }],
      formIds: ["form-1"],
      caseId: "case-1",
      encounterId: "enc-1",
      appointmentKind: "OUTPATIENT",
    });
    const resource = await DeveloperFhirService.getAppointment(
      "org-1",
      "apt-1",
    );
    expect(mockData.getAppointment).toHaveBeenCalledWith("org-1", "apt-1");
    expect(
      resource?.participant.some(
        (p) => p.actor?.reference === "Practitioner/staff-1",
      ),
    ).toBe(true);
    const urls = resource?.extension?.map((ext) => ext.url) ?? [];
    expect(urls).toContain(
      "https://yosemitecrew.com/fhir/StructureDefinition/appointment-case-id",
    );
  });
});

describe("DeveloperFhirService patients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps list rows through toFHIRCompanion", async () => {
    mockData.listPatients.mockResolvedValue({
      items: [patientRow],
      pagination,
    });
    const page = await DeveloperFhirService.listPatients({
      organisationId: "org-1",
      limit: 50,
      status: "active",
    });
    const resource = page.resources[0];
    expect(resource.resourceType).toBe("Patient");
    expect(resource.id).toBe("pat-1");
    expect(resource.active).toBe(true);
    expect(resource.name?.[0]?.text).toBe("Biscuit");
    expect(resource.birthDate).toBe("2020-01-15");
    expect(resource.gender).toBe("male");
    expect(resource.identifier?.[0]?.value).toBe("chip-123");
  });

  it("read maps archived detail rows to active false", async () => {
    mockData.getPatient.mockResolvedValue({
      ...patientRow,
      status: "archived",
      speciesCode: "canislf",
      breedCode: "beagle",
      currentWeight: 12.5,
      colour: "brown",
      allergy: null,
      isNeutered: true,
      passportNumber: "P-9",
    });
    const resource = await DeveloperFhirService.getPatient("org-1", "pat-1");
    expect(resource?.active).toBe(false);
    expect(resource?.identifier?.map((id) => id.value)).toEqual(
      expect.arrayContaining(["chip-123", "P-9"]),
    );
  });

  it("read returns null when the data service finds nothing", async () => {
    mockData.getPatient.mockResolvedValue(null);
    await expect(
      DeveloperFhirService.getPatient("org-1", "missing"),
    ).resolves.toBeNull();
  });
});

describe("DeveloperFhirService encounters", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps rows through toFHIREncounter", async () => {
    mockData.listEncounters.mockResolvedValue({
      items: [encounterRow],
      pagination,
    });
    const page = await DeveloperFhirService.listEncounters({
      organisationId: "org-1",
      limit: 50,
      patientId: "pat-1",
    });
    expect(mockData.listEncounters).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "pat-1" }),
    );
    const resource = page.resources[0];
    expect(resource.resourceType).toBe("Encounter");
    expect(resource.status).toBe("in-progress");
    expect(resource.class).toEqual(expect.objectContaining({ code: "AMB" }));
    expect(resource.subject?.reference).toBe("Patient/pat-1");
    expect(resource.episodeOfCare?.[0]?.reference).toBe("EpisodeOfCare/case-1");
    expect(resource.serviceProvider?.reference).toBe("Organization/org-1");
  });

  it("read returns null passthrough", async () => {
    mockData.getEncounter.mockResolvedValue(null);
    await expect(
      DeveloperFhirService.getEncounter("org-1", "missing"),
    ).resolves.toBeNull();
  });
});

describe("DeveloperFhirService invoices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps detail rows with line items through toFHIRInvoice", async () => {
    mockData.getInvoice.mockResolvedValue(invoiceDetailRow);
    const resource = await DeveloperFhirService.getInvoice("org-1", "inv-1");
    expect(resource?.resourceType).toBe("Invoice");
    expect(resource?.status).toBe("balanced");
    expect(resource?.lineItem).toHaveLength(1);
    expect(resource?.totalGross).toEqual({ value: 95, currency: "USD" });
    expect(resource?.totalNet).toEqual({ value: 90, currency: "USD" });
    expect(resource?.subject?.reference).toBe("Patient/pat-1");
  });

  it("maps list rows (no items in the select) to empty lineItem", async () => {
    const listRow = { ...invoiceDetailRow } as Record<string, unknown>;
    delete listRow.items;
    delete listRow.paymentCollectionMethod;
    mockData.listInvoices.mockResolvedValue({
      items: [listRow],
      pagination,
    });
    const page = await DeveloperFhirService.listInvoices({
      organisationId: "org-1",
      limit: 50,
    });
    const resource = page.resources[0];
    expect(resource.lineItem).toEqual([]);
    // No fabricated payment-collection-method extension on list rows.
    expect(
      resource.extension?.some(
        (ext) =>
          ext.url ===
          "https://yosemitecrew.com/fhir/StructureDefinition/payment-collection-method",
      ),
    ).toBe(false);
  });
});

describe("DeveloperFhirService organization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps the org row through toFHIROrganisation without leaking excluded fields", async () => {
    mockData.getOrganization.mockResolvedValue(organizationRow);
    const resource = await DeveloperFhirService.getOrganization("org-1");
    expect(resource?.resourceType).toBe("Organization");
    expect(resource?.id).toBe("org-1");
    expect(resource?.active).toBe(true);
    expect(resource?.name).toBe("Happy Paws");
    expect(resource?.address?.[0]?.city).toBe("Springfield");
    // The data-plane select never fetches taxId/stripeAccountId, so neither
    // the tax identifier nor the stripe extension can appear.
    expect(resource?.identifier).toBeUndefined();
    const serialized = JSON.stringify(resource);
    expect(serialized).not.toContain("stripe");
    expect(serialized).not.toContain("taxId");
  });

  it("returns null when the org row is absent", async () => {
    mockData.getOrganization.mockResolvedValue(null);
    await expect(
      DeveloperFhirService.getOrganization("org-x"),
    ).resolves.toBeNull();
  });
});
