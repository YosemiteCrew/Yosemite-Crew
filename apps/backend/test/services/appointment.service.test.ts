import {
  AppointmentService,
  AppointmentServiceError,
  assertAppointmentStatusTransition,
  buildUsageCounterPayload,
  requireBaseAppointmentInput,
  resolveCatalogSelectionSafe,
  resolvePaymentStatusByAppointmentIds,
  resolvePaymentStatusByAppointmentIdsFromPostgres,
} from "../../src/services/appointment.service";
import { InvoiceService } from "../../src/services/invoice.service";
import { StripeService } from "../../src/services/stripe.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import {
  CatalogService,
  CatalogServiceError,
} from "../../src/services/catalog.service";
import { CompanionOrganisationService } from "../../src/services/companion-organisation.service";
import { prisma } from "src/config/prisma";

// --- Global Mocks Setup ---

jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  fromAppointmentRequestDTO: jest.fn((dto) => ({
    ...dto,
    patient: dto.patient ?? dto.companion,
  })),
  toAppointmentResponseDTO: jest.fn((obj) => obj),
}));

jest.mock("../../src/services/invoice.service", () => ({
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
    getOrCreateDraftForAppointment: jest.fn(),
    handleAppointmentCancellation: jest.fn(),
    setInvoiceDepositTarget: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

jest.mock("../../src/services/stripe.service", () => ({
  StripeService: {
    createPaymentIntentForAppointment: jest.fn(),
    createPaymentIntentForInvoice: jest.fn(),
    createCheckoutSessionForInvoice: jest.fn(),
  },
}));

jest.mock("../../src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

jest.mock("../../src/services/task.service", () => ({
  TaskService: {
    createCustom: jest.fn(),
  },
}));

jest.mock("../../src/services/form.service", () => {
  class MockFormServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "FormServiceError";
    }
  }
  return {
    FormServiceError: MockFormServiceError,
    FormService: {
      getConsentFormForParent: jest.fn(),
    },
  };
});

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/services/catalog.service", () => ({
  CatalogServiceError: class CatalogServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "CatalogServiceError";
    }
  },
  CatalogService: {
    resolveSelection: jest.fn(),
  },
}));

jest.mock("../../src/services/companion-organisation.service", () => ({
  CompanionOrganisationService: {
    linkByParent: jest.fn(),
  },
}));

jest.mock("src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("src/utils/org-usage-notifications", () => ({
  sendFreePlanLimitReachedEmail: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    service: { findFirst: jest.fn() },
    appointment: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    invoice: { findMany: jest.fn() },
    admission: { findMany: jest.fn() },
    form: { findFirst: jest.fn(), findMany: jest.fn() },
    formVersion: { findFirst: jest.fn() },
    occupancy: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    organization: { findUnique: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    parent: { findUnique: jest.fn() },
    userProfile: { findFirst: jest.fn() },
    organizationUsageCounter: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    organizationBilling: { findUnique: jest.fn() },
    patientOrganisation: { findFirst: jest.fn(), create: jest.fn() },
  },
}));

const createPrismaAppointment = (overrides: Partial<any> = {}) => ({
  id: "appt_1",
  companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
  patient: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
  lead: { id: "vet_1", name: "Vet" },
  supportStaff: [],
  room: null,
  appointmentType: { id: "service_1", name: "Checkup" },
  organisationId: "org_1",
  appointmentDate: new Date("2026-01-01T10:00:00Z"),
  startTime: new Date("2026-01-01T10:00:00Z"),
  endTime: new Date("2026-01-01T11:00:00Z"),
  timeSlot: "10:00",
  durationMinutes: 60,
  status: "REQUESTED",
  isEmergency: false,
  concern: null,
  createdAt: new Date("2026-01-01T09:00:00Z"),
  updatedAt: new Date("2026-01-01T09:00:00Z"),
  attachments: null,
  formIds: [],
  ...overrides,
});

describe("AppointmentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      type: "HOSPITAL",
    });
  });

  it("covers appointment helper validation and status branches", async () => {
    expect(
      buildUsageCounterPayload({
        appointmentsUsed: null,
        toolsUsed: undefined,
        usersActiveCount: null,
        usersBillableCount: undefined,
        freeAppointmentsLimit: null,
        freeToolsLimit: undefined,
        freeUsersLimit: null,
      }),
    ).toEqual({
      appointmentsUsed: 0,
      toolsUsed: 0,
      usersActiveCount: 0,
      usersBillableCount: 0,
      freeAppointmentsLimit: 120,
      freeToolsLimit: 200,
      freeUsersLimit: 10,
      freeLimitReachedAt: undefined,
      updatedAt: undefined,
    });

    expect(() =>
      assertAppointmentStatusTransition("REQUESTED", "REQUESTED", "test"),
    ).not.toThrow();
    expect(() =>
      assertAppointmentStatusTransition("REQUESTED", "COMPLETED", "test"),
    ).toThrow(
      new AppointmentServiceError(
        "Appointment cannot transition from REQUESTED to COMPLETED in test.",
        409,
      ),
    );

    expect(() =>
      requireBaseAppointmentInput({} as any, {
        organisation: "organisation missing",
        patient: "patient missing",
        timing: "timing missing",
      }),
    ).toThrow(new AppointmentServiceError("organisation missing", 400));

    expect(() =>
      requireBaseAppointmentInput(
        {
          organisationId: "org_1",
          patient: { id: "patient_1" },
        } as any,
        {
          organisation: "organisation missing",
          patient: "patient missing",
          timing: "timing missing",
        },
      ),
    ).toThrow(new AppointmentServiceError("patient missing", 400));

    expect(() =>
      requireBaseAppointmentInput(
        {
          organisationId: "org_1",
          patient: { id: "patient_1", parent: { id: "parent_1" } },
        } as any,
        {
          organisation: "organisation missing",
          patient: "patient missing",
          timing: "timing missing",
        },
      ),
    ).toThrow(new AppointmentServiceError("timing missing", 400));

    (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
      new CatalogServiceError("Not found", 404),
    );
    await expect(
      resolveCatalogSelectionSafe("svc_1", "org_1"),
    ).resolves.toBeNull();

    (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
      new CatalogServiceError("Boom", 500),
    );
    await expect(
      resolveCatalogSelectionSafe("svc_1", "org_1"),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("covers payment status helpers for postgres and empty inputs", async () => {
    (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
      { appointmentId: "appt_1", status: "PAID" },
      { appointmentId: "appt_1", status: "PENDING" },
      { appointmentId: null, status: "PAID" },
    ]);
    const postgresMap = await resolvePaymentStatusByAppointmentIdsFromPostgres([
      "appt_1",
    ]);
    expect(postgresMap.get("appt_1")).toBe("UNPAID");

    // Empty input branch
    await expect(resolvePaymentStatusByAppointmentIds([])).resolves.toEqual(
      new Map(),
    );
  });

  describe("AppointmentServiceError", () => {
    it("should configure error properties correctly", () => {
      const err = new AppointmentServiceError("Test", 400);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("AppointmentServiceError");
    });
  });

  describe("createRequestedFromMobile validation", () => {
    const baseDto = {
      organisationId: "org_1",
      companion: { id: "comp_1", parent: { id: "parent_1" } },
      appointmentType: { id: "svc_1" },
      startTime: new Date(),
      endTime: new Date(),
      durationMinutes: 30,
      concern: "Checkup",
    };

    it("should throw 400 if organisationId is missing", async () => {
      await expect(
        AppointmentService.createRequestedFromMobile({
          ...baseDto,
          organisationId: undefined,
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError("organisationId is required", 400),
      );
    });

    it("should throw 400 if companion or parent is missing", async () => {
      await expect(
        AppointmentService.createRequestedFromMobile({
          ...baseDto,
          companion: {},
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Companion and parent details are required",
          400,
        ),
      );
    });

    it("should throw 400 if time details are missing", async () => {
      await expect(
        AppointmentService.createRequestedFromMobile({
          ...baseDto,
          startTime: undefined,
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "startTime, endTime, durationMinutes required",
          400,
        ),
      );
    });

    it("should treat a 404 catalog lookup as a missing selection", async () => {
      (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
        new CatalogServiceError("Not found", 404),
      );
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow(
        new AppointmentServiceError("Invalid service selected", 404),
      );
    });

    it("should reject catalog selections that are not bookable for outpatient visits", async () => {
      (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
        productItemId: "prod_1",
        legacyServiceId: "svc_1",
        isBookable: false,
        appointmentKinds: [],
      });
      (prisma.service.findFirst as jest.Mock).mockResolvedValue({
        id: "svc_1",
        serviceType: "STANDARD",
      });

      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Selected product is not bookable for outpatient appointments.",
          400,
        ),
      );
    });
  });

  describe("createAppointmentFromPms validation", () => {
    const basePmsDto = {
      organisationId: "org_1",
      companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
      appointmentType: { id: "service_1", name: "Consult" },
      lead: { id: "vet_1", name: "Dr. Smith" },
      supportStaff: [{ id: "s1", name: "Nurse" }],
      startTime: new Date(),
      endTime: new Date(),
      durationMinutes: 30,
      room: { id: "r1", name: "Room 1" },
    };

    it("should throw 400 on validation failures", async () => {
      await expect(
        AppointmentService.createAppointmentFromPms(
          { ...basePmsDto, lead: undefined } as any,
          false,
        ),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Lead veterinarian (vet) is required.",
          400,
        ),
      );

      await expect(
        AppointmentService.createAppointmentFromPms(
          { ...basePmsDto, appointmentType: undefined } as any,
          false,
        ),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Service (appointmentType.id) is required.",
          400,
        ),
      );
    });

    it("should throw 400 when required fields are missing", async () => {
      await expect(
        AppointmentService.createAppointmentFromPms(
          { ...basePmsDto, organisationId: undefined } as any,
          false,
        ),
      ).rejects.toThrow(
        new AppointmentServiceError("organisationId is required.", 400),
      );

      await expect(
        AppointmentService.createAppointmentFromPms(
          { ...basePmsDto, companion: undefined } as any,
          false,
        ),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Companion and parent information is required.",
          400,
        ),
      );

      await expect(
        AppointmentService.createAppointmentFromPms(
          { ...basePmsDto, startTime: undefined } as any,
          false,
        ),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "startTime, endTime and durationMinutes are required.",
          400,
        ),
      );
    });

    it("should treat a 404 catalog lookup as a missing selection for PMS requests", async () => {
      (CatalogService.resolveSelection as jest.Mock).mockRejectedValueOnce(
        new CatalogServiceError("Not found", 404),
      );
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AppointmentService.createAppointmentFromPms(basePmsDto as any, false),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Invalid or inactive service for this organisation.",
          404,
        ),
      );
    });

    it("should throw 400 for invalid payment collection method", async () => {
      await expect(
        AppointmentService.createAppointmentFromPms(
          basePmsDto as any,
          false,
          "invalid",
        ),
      ).rejects.toThrow(
        new AppointmentServiceError("Invalid payment collection method.", 400),
      );
    });

    it("should throw when in-clinic payment requested with online payment", async () => {
      await expect(
        AppointmentService.createAppointmentFromPms(
          basePmsDto as any,
          true,
          "PAYMENT_AT_CLINIC",
        ),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Cannot create online payment for in-clinic collection.",
          400,
        ),
      );
    });
  });

  describe("cancelAppointment", () => {
    it("throws on invalid status transition", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
        id: "appt_1",
        status: "COMPLETED",
        organisationId: "org_1",
      });
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue({ action: "NO_ACTION" });

      await expect(
        AppointmentService.cancelAppointment("appt_1", "reason"),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Appointment cannot transition from COMPLETED to CANCELLED in cancelAppointment.",
          409,
        ),
      );
    });
  });

  describe("payment status mapping", () => {
    it("returns UNPAID when unpaid invoices exist", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ id: "appt_2", status: "REQUESTED" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        { appointmentId: "appt_2", status: "PAID" },
        { appointmentId: "appt_2", status: "PENDING" },
      ]);

      const res = await AppointmentService.getById("appt_2");
      expect((res as any).paymentStatus).toBe("UNPAID");
    });

    it("returns empty list without invoice lookup when no rows", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await AppointmentService.getAppointmentsForParent("parent_1");
      expect(res).toEqual([]);
      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });
  });

  describe("createRequestedFromMobile (postgres)", () => {
    it("should create requested appointment and return payment intent", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      prisma.service.findFirst.mockResolvedValue({
        id: "service_1",
        organisationId: "org_1",
        isActive: true,
        serviceType: "OBSERVATION_TOOL",
        observationToolId: "tool_1",
      });
      prisma.organization.findUnique.mockResolvedValue({ type: "HOSPITAL" });
      prisma.organizationBilling.findUnique.mockResolvedValue({ plan: "free" });
      prisma.organizationUsageCounter.findUnique.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 0,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
      });
      prisma.organizationUsageCounter.update.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 1,
        freeAppointmentsLimit: 5,
        toolsUsed: 1,
        freeToolsLimit: 5,
        freeLimitReachedAt: null,
        usersActiveCount: 0,
        usersBillableCount: 0,
        freeUsersLimit: 10,
        updatedAt: new Date(),
      });
      prisma.organizationUsageCounter.updateMany.mockResolvedValue({
        count: 1,
      });
      prisma.form.findFirst.mockResolvedValue({ id: "form_1" });
      prisma.formVersion.findFirst.mockResolvedValue({ id: "fv_1" });
      prisma.appointment.create.mockResolvedValue({
        id: "appt_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        lead: null,
        supportStaff: [],
        room: null,
        appointmentType: { id: "service_1", name: "Checkup" },
        organisationId: "org_1",
        appointmentDate: startTime,
        startTime,
        endTime,
        timeSlot: "10:00",
        durationMinutes: 30,
        status: "REQUESTED",
        isEmergency: false,
        concern: null,
        createdAt: startTime,
        updatedAt: startTime,
        attachments: null,
        formIds: ["form_1"],
      });
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_1", totalAmount: 25 });
      prisma.invoice.findMany.mockResolvedValue([
        { appointmentId: "appt_1", status: "PAID" },
      ]);

      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue({ id: "pi_1" });

      const dto = {
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        appointmentType: { id: "service_1", name: "Checkup" },
        startTime,
        endTime,
        durationMinutes: 30,
        concern: "check",
        isEmergency: false,
        formIds: [],
      } as any;

      const result = await AppointmentService.createRequestedFromMobile(dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.appointment.create).toHaveBeenCalled();
      expect(CompanionOrganisationService.linkByParent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "parent_1",
          patientId: "comp_1",
          organisationId: "org_1",
          organisationType: "HOSPITAL",
        }),
      );
      expect(prisma.organizationUsageCounter.update).toHaveBeenCalled();
      expect(InvoiceService.setInvoiceDepositTarget).toHaveBeenCalledWith(
        "inv_1",
        25,
      );
      expect(result.paymentIntent).toEqual({ id: "pi_1" });
    });

    it("should proceed when consent form lookup returns null", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      prisma.service.findFirst.mockResolvedValue({
        id: "service_1",
        organisationId: "org_1",
        isActive: true,
        serviceType: "STANDARD",
      });
      prisma.organization.findUnique.mockResolvedValue({ type: "HOSPITAL" });
      prisma.organizationBilling.findUnique.mockResolvedValue({ plan: "free" });
      prisma.organizationUsageCounter.findUnique.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 0,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
      });
      prisma.organizationUsageCounter.update.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 1,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
        freeLimitReachedAt: null,
        usersActiveCount: 0,
        usersBillableCount: 0,
        freeUsersLimit: 10,
        updatedAt: new Date(),
      });
      prisma.organizationUsageCounter.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.form.findFirst.mockResolvedValue(null);
      prisma.formVersion.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue(
        createPrismaAppointment({
          id: "appt_1",
          organisationId: "org_1",
          startTime,
          endTime,
          appointmentDate: startTime,
        }),
      );
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_2", totalAmount: 25 });
      prisma.invoice.findMany.mockResolvedValue([]);

      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue({ id: "pi_2" });

      const dto = {
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        appointmentType: { id: "service_1", name: "Checkup" },
        startTime,
        endTime,
        durationMinutes: 30,
        concern: "check",
        isEmergency: false,
        formIds: [],
      } as any;

      const result = await AppointmentService.createRequestedFromMobile(dto);

      expect((result.appointment as any).formIds).toEqual([]);
      expect(CompanionOrganisationService.linkByParent).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: "parent_1",
          patientId: "comp_1",
          organisationId: "org_1",
          organisationType: "HOSPITAL",
        }),
      );
      expect(InvoiceService.setInvoiceDepositTarget).toHaveBeenCalledWith(
        "inv_2",
        25,
      );
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("should collapse package catalog selections to a single invoice line and persist productItemId", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
        productItemId: "prod_bundle",
        productKind: "PACKAGE",
        name: "Dental Bundle",
        legacyServiceId: null,
        isBookable: true,
        appointmentKinds: ["OUTPATIENT"],
        finalAmount: 317.5,
        billingItems: [
          {
            productItemId: "prod_bundle",
            name: "Dental Bundle",
            kind: "PACKAGE",
            quantity: 1,
            unitPrice: 250,
            defaultDiscountPercent: 5,
          },
          {
            productItemId: "prod_xray",
            name: "Dental X-Ray",
            kind: "DIAGNOSTIC",
            quantity: 2,
            unitPrice: 40,
            defaultDiscountPercent: null,
          },
        ],
        includedItems: [],
      });

      prisma.organizationBilling.findUnique.mockResolvedValue({ plan: "free" });
      prisma.organizationUsageCounter.findUnique.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 0,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
      });
      prisma.organizationUsageCounter.update.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 1,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
        freeLimitReachedAt: null,
        usersActiveCount: 0,
        usersBillableCount: 0,
        freeUsersLimit: 10,
        updatedAt: new Date(),
      });
      prisma.organizationUsageCounter.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.appointment.create.mockResolvedValue(
        createPrismaAppointment({
          id: "appt_1",
          organisationId: "org_1",
          startTime,
          endTime,
          appointmentDate: startTime,
        }),
      );
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_cat" });
      prisma.invoice.findMany.mockResolvedValue([]);
      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue({ id: "pi_cat" });

      await AppointmentService.createRequestedFromMobile({
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        appointmentType: { id: "prod_bundle", name: "Dental Bundle" },
        startTime,
        endTime,
        durationMinutes: 30,
        concern: "check",
        isEmergency: false,
        formIds: [],
      } as any);

      expect(prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productItemId: "prod_bundle",
          }),
        }),
      );
      expect(
        InvoiceService.getOrCreateDraftForAppointment,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              description: "Dental Bundle",
              quantity: 1,
              unitPrice: 317.5,
              total: 317.5,
            },
          ],
        }),
      );
    });

    it("should ignore form when version is missing", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      prisma.service.findFirst.mockResolvedValue({
        id: "service_1",
        organisationId: "org_1",
        isActive: true,
        serviceType: "STANDARD",
      });
      prisma.organizationBilling.findUnique.mockResolvedValue({ plan: "free" });
      prisma.organizationUsageCounter.findUnique.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 0,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
      });
      prisma.organizationUsageCounter.update.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 1,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
        freeLimitReachedAt: null,
        usersActiveCount: 0,
        usersBillableCount: 0,
        freeUsersLimit: 10,
        updatedAt: new Date(),
      });
      prisma.organizationUsageCounter.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.form.findFirst.mockResolvedValue({ id: "form_1" });
      prisma.formVersion.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue(
        createPrismaAppointment({
          id: "appt_1",
          organisationId: "org_1",
          startTime,
          endTime,
          appointmentDate: startTime,
        }),
      );
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_3" });
      prisma.invoice.findMany.mockResolvedValue([]);

      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue({ id: "pi_3" });

      const dto = {
        organisationId: "org_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        appointmentType: { id: "service_1", name: "Checkup" },
        startTime,
        endTime,
        durationMinutes: 30,
        concern: "check",
        isEmergency: false,
        formIds: [],
      } as any;

      const result = await AppointmentService.createRequestedFromMobile(dto);
      expect((result.appointment as any).formIds).toEqual([]);
    });

    it("should throw if service not found", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        AppointmentService.createRequestedFromMobile({
          organisationId: "org_1",
          companion: { id: "comp_1", parent: { id: "parent_1" } },
          appointmentType: { id: "service_1" },
          startTime: new Date(),
          endTime: new Date(),
          durationMinutes: 30,
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError("Invalid service selected", 404),
      );
    });
  });

  describe("getAppointmentsForOrganisation (postgres)", () => {
    it("should throw when organisationId missing", async () => {
      await expect(
        AppointmentService.getAppointmentsForOrganisation("" as any),
      ).rejects.toThrow(
        new AppointmentServiceError("organisationId is required", 400),
      );
    });

    it("should map payment status for rows", async () => {
      const startTime = new Date();
      const row = {
        id: "appt_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        lead: null,
        supportStaff: [],
        room: null,
        appointmentType: { id: "service_1", name: "Checkup" },
        organisationId: "org_1",
        appointmentDate: startTime,
        startTime,
        endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
        timeSlot: "10:00",
        durationMinutes: 30,
        status: "REQUESTED",
        isEmergency: false,
        concern: null,
        createdAt: startTime,
        updatedAt: startTime,
        attachments: null,
        formIds: [],
      };

      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([
        { appointmentId: "appt_1", status: "PAID" },
      ]);

      const results =
        await AppointmentService.getAppointmentsForOrganisation("org_1");

      expect((results[0] as any)?.paymentStatus).toBe("PAID");
    });

    it("enriches the room with its inpatient unit", async () => {
      const startTime = new Date();
      const row = {
        id: "appt_ipd",
        encounterId: "enc_1",
        companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
        lead: null,
        supportStaff: [],
        room: { id: "room_1", name: "Recovery Room" },
        appointmentType: { id: "service_1", name: "Checkup" },
        organisationId: "org_1",
        appointmentDate: startTime,
        startTime,
        endTime: new Date(startTime.getTime() + 30 * 60 * 1000),
        timeSlot: "10:00",
        durationMinutes: 30,
        status: "REQUESTED",
        isEmergency: false,
        concern: null,
        createdAt: startTime,
        updatedAt: startTime,
        attachments: null,
        formIds: [],
      };

      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([row]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.admission.findMany as jest.Mock).mockResolvedValueOnce([
        {
          encounterId: "enc_1",
          currentUnit: {
            id: "unit_7",
            displayName: "ICU - Bed 2",
            code: "ICU-2",
          },
        },
      ]);

      const results =
        await AppointmentService.getAppointmentsForOrganisation("org_1");
      const room = (results[0] as any)?.room;

      expect(prisma.admission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: { in: ["enc_1"] } },
        }),
      );
      expect(room?.id).toBe("room_1");
      expect(room?.unitId).toBe("unit_7");
      expect(room?.unitName).toBe("ICU - Bed 2");
      expect(room?.unit).toEqual({
        id: "unit_7",
        name: "ICU - Bed 2",
        displayName: "ICU - Bed 2",
        code: "ICU-2",
      });
    });
  });

  describe("approveRequestedFromPms & extractApprovalFieldsFromFHIR", () => {
    it("should throw 400 if appointment ID is missing", async () => {
      await expect(
        AppointmentService.approveRequestedFromPms("", {} as any),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment ID missing", 400),
      );
    });

    it("should throw 400 if FHIR payload lacks lead vet (PPRF)", async () => {
      await expect(
        AppointmentService.approveRequestedFromPms("appt_1", {
          participant: [],
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Lead vet (Practitioner with code=PPRF) is required",
          400,
        ),
      );
    });

    it("should throw 404 if appointment not found", async () => {
      const fhir = {
        participant: [
          {
            type: [{ coding: [{ code: "PPRF" }] }],
            actor: { reference: "Practitioner/vet1" },
          },
        ],
      };
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.approveRequestedFromPms("appt_1", fhir as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Requested appointment not found or already processed",
          404,
        ),
      );
    });
  });

  describe("updateAppointmentPMS validation", () => {
    it("should throw 400 if id missing", async () => {
      await expect(
        AppointmentService.updateAppointmentPMS("", {} as any),
      ).rejects.toThrow();
    });

    it("should route cancelled status through cancelAppointment", async () => {
      const cancelSpy = jest
        .spyOn(AppointmentService, "cancelAppointment")
        .mockResolvedValueOnce({ status: "CANCELLED" } as any);

      const result = await AppointmentService.updateAppointmentPMS("appt_1", {
        status: "CANCELLED",
        concern: "Cancelled by PMS",
      } as any);

      expect(cancelSpy).toHaveBeenCalledWith("appt_1", "Cancelled by PMS");
      expect(result).toEqual({ status: "CANCELLED" });
    });

    it("should throw 400 if lead is missing", async () => {
      await expect(
        AppointmentService.updateAppointmentPMS("appt_1", {
          lead: undefined,
        } as any),
      ).rejects.toThrow();
    });
  });

  describe("attachFormsToAppointment validation", () => {
    it("should throw 400 for bad parameters", async () => {
      await expect(
        AppointmentService.attachFormsToAppointment("", "appt_1", ["f1"]),
      ).rejects.toThrow("Organisation ID is required");
      await expect(
        AppointmentService.attachFormsToAppointment("org_1", "", ["f1"]),
      ).rejects.toThrow("Appointment ID is required");
      await expect(
        AppointmentService.attachFormsToAppointment("org_1", "appt_1", []),
      ).rejects.toThrow("formIds are required");
      await expect(
        AppointmentService.attachFormsToAppointment("org_1", "appt_1", ["  "]),
      ).rejects.toThrow("formIds are required"); // empty after trim
    });
  });

  describe("rescheduleFromParent validation", () => {
    it("should throw 400 for invalid dates", async () => {
      await expect(
        AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: "invalid",
          endTime: "invalid",
        }),
      ).rejects.toThrow("Invalid startTime/endTime");

      await expect(
        AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: new Date(Date.now() + 100000),
          endTime: new Date(),
        }),
      ).rejects.toThrow("startTime must be before endTime");
    });
  });

  describe("Fetch and List Guards", () => {
    it("throws on missing identifiers", async () => {
      await expect(
        AppointmentService.getAppointmentsForCompanionByOrganisation("", "org"),
      ).rejects.toThrow(
        new AppointmentServiceError("patientId is required", 400),
      );
      await expect(
        AppointmentService.getAppointmentsForCompanionByOrganisation(
          "comp",
          "",
        ),
      ).rejects.toThrow(
        new AppointmentServiceError("organisationId is required", 400),
      );
      await expect(
        AppointmentService.getAppointmentsForLead(""),
      ).rejects.toThrow(new AppointmentServiceError("leadId is required", 400));
      await expect(
        AppointmentService.getAppointmentsForSupportStaff(""),
      ).rejects.toThrow(
        new AppointmentServiceError("staffId is required", 400),
      );
      await expect(
        AppointmentService.getAppointmentsForParent(""),
      ).rejects.toThrow(
        new AppointmentServiceError("parentId is required", 400),
      );
    });
  });

  describe("Postgres branches", () => {
    it("approveRequestedFromPms uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "REQUESTED" }),
      );
      (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.occupancy.create as jest.Mock).mockResolvedValue({});
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue({
        personalDetails: { profilePictureUrl: "pic" },
      });
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
        name: "Org",
      });
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const res = await AppointmentService.approveRequestedFromPms("appt_1", {
        participant: [
          {
            type: [{ coding: [{ code: "PPRF" }] }],
            actor: { reference: "Practitioner/vet_1", display: "Vet" },
          },
        ],
      } as any);

      expect(prisma.appointment.update).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it("rolls back PMS appointment creation if checkout creation fails", async () => {
      const { prisma } = require("src/config/prisma");
      const startTime = new Date("2026-02-01T10:00:00Z");
      const endTime = new Date("2026-02-01T11:00:00Z");

      prisma.service.findFirst.mockResolvedValue({
        id: "service_1",
        organisationId: "org_1",
        isActive: true,
        serviceType: "STANDARD",
      });
      prisma.organizationBilling.findUnique.mockResolvedValue({ plan: "free" });
      prisma.organizationUsageCounter.findUnique.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 0,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
      });
      prisma.organizationUsageCounter.update.mockResolvedValue({
        orgId: "org_1",
        appointmentsUsed: 1,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
        freeLimitReachedAt: null,
        usersActiveCount: 0,
        usersBillableCount: 0,
        freeUsersLimit: 10,
        updatedAt: new Date(),
      });
      prisma.organizationUsageCounter.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.appointment.create.mockResolvedValue(
        createPrismaAppointment({
          id: "appt_rollback",
          organisationId: "org_1",
          startTime,
          endTime,
          appointmentDate: startTime,
        }),
      );
      prisma.appointment.deleteMany.mockResolvedValue({ count: 1 });
      prisma.occupancy.deleteMany.mockResolvedValue({ count: 1 });
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue(
        {
          id: "inv_rollback",
          totalAmount: 25,
        },
      );
      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockRejectedValue(new Error("checkout failed"));
      prisma.invoice.findMany.mockResolvedValue([]);

      await expect(
        AppointmentService.createAppointmentFromPms(
          {
            organisationId: "org_1",
            lead: { id: "vet_1", name: "Vet" },
            companion: {
              id: "comp_1",
              parent: { id: "parent_1" },
              name: "Pet",
            },
            appointmentType: { id: "service_1", name: "Checkup" },
            startTime,
            endTime,
            durationMinutes: 30,
            concern: "check",
            isEmergency: false,
            formIds: [],
          } as any,
          true,
          "PAYMENT_LINK",
        ),
      ).rejects.toThrow(
        new AppointmentServiceError("Unable to create appointment", 500),
      );

      expect(InvoiceService.updateStatus).toHaveBeenCalledWith(
        "inv_rollback",
        "CANCELLED",
      );
      expect(prisma.occupancy.deleteMany).toHaveBeenCalled();
      expect(prisma.appointment.deleteMany).toHaveBeenCalled();
    });

    it("checkInAppointment uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "CHECKED_IN" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const res = await AppointmentService.checkInAppointment("appt_1");
      expect(res.status).toBe("CHECKED_IN");
      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it("checkInAppointment throws when appointment missing or invalid status", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        AppointmentService.checkInAppointment("appt_1"),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment not found", 404),
      );

      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
        createPrismaAppointment({ status: "COMPLETED" }),
      );
      await expect(
        AppointmentService.checkInAppointment("appt_1"),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Only upcoming appointments can be checked in",
          400,
        ),
      );
    });

    it("cancelAppointment uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "CANCELLED" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);

      await AppointmentService.cancelAppointment("appt_1", "reason");

      expect(prisma.appointment.update).toHaveBeenCalled();
      expect(prisma.occupancy.deleteMany).toHaveBeenCalled();
    });

    it("cancelAppointmentFromParent uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({
          status: "UPCOMING",
          lead: { id: "vet_1", name: "Vet" },
        }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "CANCELLED" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);

      await AppointmentService.cancelAppointmentFromParent(
        "appt_1",
        "parent_1",
        "reason",
      );

      expect(prisma.appointment.update).toHaveBeenCalled();
      expect(prisma.occupancy.deleteMany).toHaveBeenCalled();
    });

    it("rejectRequestedAppointment uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "REQUESTED" }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "CANCELLED" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);

      await AppointmentService.rejectRequestedAppointment("appt_1");

      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it("updateAppointmentPMS uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.occupancy.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.occupancy.create as jest.Mock).mockResolvedValue({});
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await AppointmentService.updateAppointmentPMS("appt_1", {
        lead: { id: "vet_1", name: "Vet" },
        startTime: new Date("2026-02-01T10:00:00Z"),
        endTime: new Date("2026-02-01T11:00:00Z"),
        concern: "Updated concern",
      } as any);

      expect(prisma.occupancy.create).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "APPOINTMENT_RESCHEDULED",
          metadata: expect.objectContaining({
            concern: "Updated concern",
          }),
        }),
      );
    });

    it("attachFormsToAppointment uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ formIds: [] }),
      );
      (prisma.form.findMany as jest.Mock).mockResolvedValue([{ id: "form_1" }]);
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ formIds: ["form_1"] }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await AppointmentService.attachFormsToAppointment("org_1", "appt_1", [
        "form_1",
      ]);

      expect(prisma.appointment.update).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });

    it("checkInAppointmentParent uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "CHECKED_IN" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await AppointmentService.checkInAppointmentParent("appt_1", "parent_1");

      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it("rescheduleFromParent uses prisma path", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "UPCOMING" }),
      );
      (prisma.appointment.update as jest.Mock).mockResolvedValue(
        createPrismaAppointment({ status: "REQUESTED" }),
      );
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      await AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
        startTime: new Date("2026-02-01T10:00:00Z"),
        endTime: new Date("2026-02-01T11:00:00Z"),
      });

      expect(prisma.occupancy.deleteMany).toHaveBeenCalled();
      expect(prisma.appointment.update).toHaveBeenCalled();
    });

    it("rescheduleFromParent throws for missing appointment, parent mismatch, or invalid status", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: new Date("2026-02-01T10:00:00Z"),
          endTime: new Date("2026-02-01T11:00:00Z"),
        }),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment not found", 404),
      );

      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
        createPrismaAppointment({
          status: "UPCOMING",
          companion: { id: "comp_1", parent: { id: "other" }, name: "Pet" },
          patient: { id: "comp_1", parent: { id: "other" }, name: "Pet" },
        }),
      );
      await expect(
        AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: new Date("2026-02-01T10:00:00Z"),
          endTime: new Date("2026-02-01T11:00:00Z"),
        }),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "You are not allowed to modify this appointment.",
          403,
        ),
      );

      (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
        createPrismaAppointment({ status: "COMPLETED" }),
      );
      await expect(
        AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
          startTime: new Date("2026-02-01T10:00:00Z"),
          endTime: new Date("2026-02-01T11:00:00Z"),
        }),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Completed or cancelled appointments cannot be rescheduled.",
          400,
        ),
      );
    });

    it("getAppointmentsForCompanion uses prisma path", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        createPrismaAppointment({ id: "appt_1" }),
      ]);
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([
        { id: "org_1", name: "Org", address: null, imageUrl: null },
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const res =
        await AppointmentService.getAppointmentsForCompanion("comp_1");
      expect(res[0]?.organisation?.name).toBe("Org");
    });

    it("getAppointmentsForCompanionByOrganisation uses prisma path", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        createPrismaAppointment({ id: "appt_1" }),
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const res =
        await AppointmentService.getAppointmentsForCompanionByOrganisation(
          "comp_1",
          "org_1",
        );
      expect(res).toHaveLength(1);
    });

    it("getById throws when appointment missing (postgres)", async () => {
      (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.getById("appt_missing")).rejects.toThrow(
        new AppointmentServiceError("Appointment not found", 404),
      );
    });

    it("getAppointmentsForLead/supportStaff/ByDateRange use prisma path", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        createPrismaAppointment({ id: "appt_1" }),
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const orgRes = await AppointmentService.getAppointmentsForOrganisation(
        "org_1",
        {
          status: ["UPCOMING"],
          startDate: new Date("2026-02-01T10:00:00Z"),
          endDate: new Date("2026-02-01T11:00:00Z"),
        },
      );
      expect(orgRes).toHaveLength(1);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: "org_1",
            status: { in: ["UPCOMING"] },
            startTime: {
              gte: new Date("2026-02-01T10:00:00Z"),
              lte: new Date("2026-02-01T11:00:00Z"),
            },
          }),
        }),
      );

      const leadRes = await AppointmentService.getAppointmentsForLead("vet_1");
      expect(leadRes).toHaveLength(1);

      const staffRes =
        await AppointmentService.getAppointmentsForSupportStaff("staff_1");
      expect(staffRes).toHaveLength(1);

      const dateRes = await AppointmentService.getAppointmentsByDateRange(
        "org_1",
        new Date("2026-02-01T10:00:00Z"),
        new Date("2026-02-01T11:00:00Z"),
        ["UPCOMING"],
      );
      expect(dateRes).toHaveLength(1);
    });

    it("searchAppointments uses prisma path", async () => {
      (prisma.appointment.findMany as jest.Mock).mockResolvedValue([
        createPrismaAppointment({ id: "appt_1" }),
      ]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const res = await AppointmentService.searchAppointments({
        organisationId: "org_1",
        status: ["UPCOMING"],
        patientId: "comp_1",
        parentId: "parent_1",
        leadId: "vet_1",
        staffId: "staff_1",
        startDate: new Date("2026-02-01T10:00:00Z"),
        endDate: new Date("2026-02-01T11:00:00Z"),
      });

      expect(res).toHaveLength(1);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.any(Array),
            startTime: {
              gte: new Date("2026-02-01T10:00:00Z"),
              lte: new Date("2026-02-01T11:00:00Z"),
            },
          }),
        }),
      );
    });

    it("markNoShowAppointments uses prisma path", async () => {
      (prisma.appointment.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const res = await AppointmentService.markNoShowAppointments({
        graceMinutes: 5,
      });

      expect(prisma.appointment.updateMany).toHaveBeenCalled();
      expect(res.matched).toBe(2);
    });
  });
});
