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
import { NotificationService } from "../../src/services/notification.service";
import { TaskService } from "../../src/services/task.service";
import { FormServiceError } from "../../src/services/form.service";
import { fromAppointmentRequestDTO } from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { sendEmailTemplate } from "src/utils/email";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import logger from "src/utils/logger";

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

// ---------------------------------------------------------------------------
// Conditional / side-effect coverage.
//
// The suite above walks the happy paths; this one drives the guards, the
// fallback expressions and the notification side effects on both sides of each
// condition, so a regression that flips a guard fails a test rather than just
// changing a coverage number.
// ---------------------------------------------------------------------------
describe("AppointmentService conditional paths", () => {
  const mobileDto = () => ({
    organisationId: "org_1",
    companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
    appointmentType: { id: "service_1", name: "Checkup" },
    startTime: new Date("2026-01-01T10:00:00Z"),
    endTime: new Date("2026-01-01T10:30:00Z"),
    durationMinutes: 30,
  });

  // Deliberately carries no concern / isEmergency / formIds so the `?? default`
  // arms of the create payload are exercised.
  const pmsDto = () => ({
    organisationId: "org_1",
    companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
    appointmentType: { id: "service_1", name: "Consult" },
    lead: { id: "vet_1", name: "Dr Lead" },
    startTime: new Date("2026-01-01T10:00:00Z"),
    endTime: new Date("2026-01-01T11:00:00Z"),
    durationMinutes: 60,
  });

  const leadOnlyFhir = {
    participant: [
      {
        type: [{ coding: [{ code: "PPRF" }] }],
        actor: { reference: "Practitioner/vet_1", display: "Dr Lead" },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue(null);
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "service_1",
      organisationId: "org_1",
      isActive: true,
      serviceType: "STANDARD",
      name: "Consultation service",
      cost: 60,
      maxDiscount: null,
    });
    (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.admission.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.form.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.formVersion.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.form.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.occupancy.create as jest.Mock).mockResolvedValue({});
    (prisma.occupancy.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      type: "HOSPITAL",
      name: "Happy Paws",
    });
    (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      plan: "pro",
    });
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValue({
      orgId: "org_1",
    });
    (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue({
      orgId: "org_1",
    });
    (prisma.organizationUsageCounter.updateMany as jest.Mock).mockResolvedValue(
      { count: 0 },
    );
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    (prisma.appointment.deleteMany as jest.Mock).mockResolvedValue({
      count: 1,
    });
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment(),
    );
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue(null);
    (
      InvoiceService.handleAppointmentCancellation as jest.Mock
    ).mockResolvedValue(true);
    (
      InvoiceService.getOrCreateDraftForAppointment as jest.Mock
    ).mockResolvedValue({ id: "inv_1", totalAmount: 60, currency: "usd" });
    (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({
      id: "inv_1",
      totalAmount: 60,
      currency: "usd",
    });
    (InvoiceService.updateStatus as jest.Mock).mockResolvedValue(undefined);
    (
      StripeService.createPaymentIntentForInvoice as jest.Mock
    ).mockResolvedValue({ id: "pi_1" });
    (
      StripeService.createCheckoutSessionForInvoice as jest.Mock
    ).mockResolvedValue({ url: "https://checkout.example/abc" });
    (sendEmailTemplate as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -- status helpers -------------------------------------------------------

  it("normalises the legacy NO_PAYMENT status and tolerates an unknown status", () => {
    expect(() =>
      assertAppointmentStatusTransition("NO_PAYMENT", "UPCOMING", "ctx"),
    ).not.toThrow();

    expect(() =>
      assertAppointmentStatusTransition("NO_PAYMENT", "COMPLETED", "ctx"),
    ).toThrow(
      new AppointmentServiceError(
        "Appointment cannot transition from REQUESTED to COMPLETED in ctx.",
        409,
      ),
    );

    expect(() =>
      assertAppointmentStatusTransition("ARCHIVED" as never, "UPCOMING", "ctx"),
    ).toThrow(
      new AppointmentServiceError(
        "Appointment cannot transition from ARCHIVED to UPCOMING in ctx.",
        409,
      ),
    );
  });

  // -- read paths -----------------------------------------------------------

  it("getById rejects a blank appointment id", async () => {
    await expect(AppointmentService.getById("")).rejects.toThrow(
      new AppointmentServiceError("Appointment ID is required", 400),
    );
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it("maps a sparse appointment row onto domain defaults", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        lead: null,
        supportStaff: null,
        room: null,
        appointmentType: null,
        isEmergency: null,
        concern: null,
        attachments: null,
        formIds: null,
      }),
    );

    const res = (await AppointmentService.getById("appt_1")) as never as Record<
      string,
      unknown
    >;

    expect(res.lead).toBeUndefined();
    expect(res.room).toBeUndefined();
    expect(res.appointmentType).toBeUndefined();
    expect(res.supportStaff).toEqual([]);
    expect(res.isEmergency).toBeUndefined();
    expect(res.concern).toBeUndefined();
    expect(res.formIds).toEqual([]);
    expect(res.paymentStatus).toBe("UNPAID");
  });

  it("getAppointmentsForCompanion validates the id, short-circuits an empty result and tolerates an unknown organisation", async () => {
    await expect(
      AppointmentService.getAppointmentsForCompanion(""),
    ).rejects.toThrow(
      new AppointmentServiceError("patientId is required", 400),
    );

    (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      AppointmentService.getAppointmentsForCompanion("comp_1"),
    ).resolves.toEqual([]);
    expect(prisma.organization.findMany).not.toHaveBeenCalled();

    (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([
      createPrismaAppointment(),
    ]);
    (prisma.organization.findMany as jest.Mock).mockResolvedValueOnce([]);

    const res = await AppointmentService.getAppointmentsForCompanion("comp_1");
    expect(res).toHaveLength(1);
    expect(res[0]?.organisation).toBeNull();
  });

  it("getAppointmentsForOrganisation builds one-sided date filters", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

    await AppointmentService.getAppointmentsForOrganisation("org_1", {
      status: [],
      endDate: new Date("2026-02-02T00:00:00Z"),
    });
    expect(prisma.appointment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          startTime: { gte: undefined, lte: new Date("2026-02-02T00:00:00Z") },
        },
      }),
    );

    await AppointmentService.getAppointmentsForOrganisation("org_1", {
      startDate: new Date("2026-02-01T00:00:00Z"),
    });
    expect(prisma.appointment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          startTime: { gte: new Date("2026-02-01T00:00:00Z"), lte: undefined },
        },
      }),
    );
  });

  it("searchAppointments builds one-sided date filters and omits AND when nothing is scoped", async () => {
    (prisma.appointment.findMany as jest.Mock).mockResolvedValue([]);

    await AppointmentService.searchAppointments({
      endDate: new Date("2026-02-02T00:00:00Z"),
    });
    expect(prisma.appointment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          startTime: { gte: undefined, lte: new Date("2026-02-02T00:00:00Z") },
        },
      }),
    );

    await AppointmentService.searchAppointments({
      startDate: new Date("2026-02-01T00:00:00Z"),
      status: [],
    });
    expect(prisma.appointment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          startTime: { gte: new Date("2026-02-01T00:00:00Z"), lte: undefined },
        },
      }),
    );
  });

  it("markNoShowAppointments defaults to a 15 minute grace period", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-01T12:00:00Z"));
    (prisma.appointment.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    const res = await AppointmentService.markNoShowAppointments();

    expect(prisma.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "UPCOMING",
          endTime: { lt: new Date("2026-03-01T11:45:00Z") },
        },
      }),
    );
    expect(res).toEqual({ matched: 0, modified: 0 });
  });

  // -- cancellation ---------------------------------------------------------

  it("cancelAppointment rejects an unknown appointment and is idempotent once cancelled", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.cancelAppointment("appt_1"),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "CANCELLED" }),
    );
    const res = await AppointmentService.cancelAppointment("appt_1");

    expect(res.status).toBe("CANCELLED");
    expect(InvoiceService.handleAppointmentCancellation).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("cancelAppointment falls back to the default reason, keeps the stored concern and skips occupancy cleanup without a lead", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "UPCOMING",
        lead: null,
        concern: "Existing concern",
      }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "CANCELLED",
        concern: "Existing concern",
      }),
    );

    await AppointmentService.cancelAppointment("appt_1");

    expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalledWith(
      "appt_1",
      "Cancelled",
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concern: "Existing concern" }),
      }),
    );
    expect(prisma.occupancy.deleteMany).not.toHaveBeenCalled();
    expect(NotificationService.sendToUser).toHaveBeenCalledWith(
      "parent_1",
      expect.objectContaining({ type: "APPOINTMENTS" }),
    );
  });

  it("cancelAppointment leaves the concern unset when neither a reason nor a stored concern exists", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "UPCOMING",
        lead: { name: "Vet without id" },
        concern: null,
      }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "CANCELLED" }),
    );

    await AppointmentService.cancelAppointment("appt_1");

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concern: undefined }),
      }),
    );
    expect(prisma.occupancy.deleteMany).not.toHaveBeenCalled();
  });

  it("cancelAppointmentFromParent enforces ownership and a cancellable status", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.cancelAppointmentFromParent("appt_1", "parent_1", "r"),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ patient: null }),
    );
    await expect(
      AppointmentService.cancelAppointmentFromParent("appt_1", "parent_1", "r"),
    ).rejects.toThrow(new AppointmentServiceError("Not your appointment", 403));

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "COMPLETED" }),
    );
    await expect(
      AppointmentService.cancelAppointmentFromParent("appt_1", "parent_1", "r"),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Only requested or upcoming appointments can be cancelled",
        400,
      ),
    );

    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("cancelAppointmentFromParent surfaces an invoice cancellation refusal", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    (
      InvoiceService.handleAppointmentCancellation as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      AppointmentService.cancelAppointmentFromParent("appt_1", "parent_1", "r"),
    ).rejects.toThrow(
      new AppointmentServiceError("Not able to cancle appointment", 400),
    );
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("cancelAppointmentFromParent attributes the audit to the parent when the row carries no patient id", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING", lead: null }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "CANCELLED",
        patient: { name: "Pet" },
        companion: null,
      }),
    );

    await AppointmentService.cancelAppointmentFromParent(
      "appt_1",
      "parent_1",
      undefined as unknown as string,
    );

    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "parent_1",
        actorType: "PARENT",
        metadata: { status: "CANCELLED", reason: "Cancelled" },
      }),
    );
    expect(prisma.occupancy.deleteMany).not.toHaveBeenCalled();
  });

  it("rejectRequestedAppointment enforces existence and a REQUESTED status", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.rejectRequestedAppointment("appt_1"),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found.", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    await expect(
      AppointmentService.rejectRequestedAppointment("appt_1"),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Only REQUESTED appointments can be rejected.",
        400,
      ),
    );
  });

  it("rejectRequestedAppointment records the supplied reason for a legacy NO_PAYMENT row", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "NO_PAYMENT" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "CANCELLED", concern: "Duplicate" }),
    );

    await AppointmentService.rejectRequestedAppointment("appt_1", "Duplicate");

    expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalledWith(
      "appt_1",
      "Duplicate",
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concern: "Duplicate" }),
      }),
    );
  });

  // -- reschedule -----------------------------------------------------------

  it("rescheduleFromParent keeps the assignment for a still-requested appointment and honours explicit changes", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "REQUESTED",
        lead: { id: "vet_1", name: "Vet" },
        supportStaff: [{ id: "staff_1" }],
        room: { id: "room_1" },
      }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );

    await AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
      startTime: "2026-02-01T10:00:00Z",
      endTime: "2026-02-01T11:00:00Z",
      durationMinutes: 45,
      concern: "Limping",
      isEmergency: true,
    });

    expect(prisma.occupancy.deleteMany).not.toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REQUESTED",
          durationMinutes: 45,
          concern: "Limping",
          isEmergency: true,
          lead: { id: "vet_1", name: "Vet" },
          supportStaff: [{ id: "staff_1" }],
          room: { id: "room_1" },
        }),
      }),
    );
  });

  // -- approve from PMS -----------------------------------------------------

  it("approveRequestedFromPms refuses an appointment that is no longer requested", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await expect(
      AppointmentService.approveRequestedFromPms(
        "appt_1",
        leadOnlyFhir as never,
      ),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
      ),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("approveRequestedFromPms refuses a slot the vet already occupies", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );
    (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue({
      id: "occ_1",
    });

    await expect(
      AppointmentService.approveRequestedFromPms(
        "appt_1",
        leadOnlyFhir as never,
      ),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Selected vet is not available for this slot",
        409,
      ),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("approveRequestedFromPms falls back to an avatar url, a default vet name and reads the room participant", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "UPCOMING",
        lead: null,
        organisationId: "",
      }),
    );

    await AppointmentService.approveRequestedFromPms("appt_1", {
      participant: [
        {
          type: [{ coding: [{ code: "PPRF" }] }],
          actor: { reference: "Practitioner/vet_1" },
        },
        { type: [{ coding: [{ code: "SPRF" }] }], actor: {} },
        { type: [{ coding: [{ code: "LOC" }] }], actor: {} },
      ],
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lead: {
            id: "vet_1",
            name: "Vet",
            profileUrl: "https://ui-avatars.com/api/?name=undefined",
          },
          supportStaff: [{ id: "", name: "" }],
          room: { id: "", name: "" },
        }),
      }),
    );
    // organisationId is blank on the updated row, so the name lookup is skipped
    // and there is no lead/support staff to email.
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });

  it("approveRequestedFromPms emails every assigned member it can resolve and tolerates an unnamed organisation", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );
    (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue({
      personalDetails: { profilePictureUrl: "https://cdn.example/pic.png" },
    });
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "UPCOMING",
        lead: { id: "vet_1", name: "Dr Lead" },
        supportStaff: [
          { id: "staff_named", name: "Nurse Joy" },
          { id: "staff_unnamed" },
          { id: "staff_ghost", name: "Ghost" },
        ],
        appointmentType: null,
        room: null,
      }),
    );
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: null,
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        userId: "vet_1",
        email: "vet@example.com",
        firstName: "Ada",
        lastName: "Vet",
      },
      {
        userId: "staff_named",
        email: "nurse@example.com",
        firstName: null,
        lastName: null,
      },
      {
        userId: "staff_unnamed",
        email: "anon@example.com",
        firstName: null,
        lastName: null,
      },
      { userId: "staff_ghost", email: null, firstName: null, lastName: null },
    ]);

    await AppointmentService.approveRequestedFromPms(
      "appt_1",
      leadOnlyFhir as never,
    );

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lead: expect.objectContaining({
            profileUrl: "https://cdn.example/pic.png",
          }),
        }),
      }),
    );
    // The staff member without an email address is skipped entirely.
    expect(sendEmailTemplate).toHaveBeenCalledTimes(3);
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vet@example.com",
        templateId: "appointmentAssigned",
        templateData: expect.objectContaining({
          employeeName: "Ada Vet",
          organisationName: undefined,
          appointmentType: undefined,
          locationName: undefined,
        }),
      }),
    );
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "nurse@example.com",
        templateData: expect.objectContaining({ employeeName: "Nurse Joy" }),
      }),
    );
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "anon@example.com",
        templateData: expect.objectContaining({ employeeName: undefined }),
      }),
    );
  });

  // -- attach forms ---------------------------------------------------------

  it("attachFormsToAppointment enforces existence, tenancy and form resolution", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.attachFormsToAppointment("org_1", "appt_1", ["f1"]),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ organisationId: "other_org" }),
    );
    await expect(
      AppointmentService.attachFormsToAppointment("org_1", "appt_1", ["f1"]),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Appointment does not belong to organisation",
        403,
      ),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment(),
    );
    (prisma.form.findMany as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      AppointmentService.attachFormsToAppointment("org_1", "appt_1", [
        "f1",
        "f2",
      ]),
    ).rejects.toThrow(
      new AppointmentServiceError("Forms not found: f1, f2", 404),
    );
  });

  it("attachFormsToAppointment is a no-op when every form is already attached", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ formIds: ["f1"] }),
    );
    (prisma.form.findMany as jest.Mock).mockResolvedValue([{ id: "f1" }]);

    const res = await AppointmentService.attachFormsToAppointment(
      "org_1",
      "appt_1",
      ["f1"],
    );

    expect(res.id).toBe("appt_1");
    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
  });

  it("attachFormsToAppointment merges onto a row that has no formIds yet", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ formIds: null }),
    );
    (prisma.form.findMany as jest.Mock).mockResolvedValue([{ id: "f1" }]);
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ formIds: ["f1"] }),
    );

    await AppointmentService.attachFormsToAppointment("org_1", "appt_1", [
      "f1",
    ]);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ formIds: ["f1"] }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "FORM_ATTACHED", entityId: "f1" }),
    );
  });

  // -- parent check-in ------------------------------------------------------

  it("checkInAppointmentParent enforces existence, ownership and an upcoming status", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.checkInAppointmentParent("appt_1", "parent_1"),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    await expect(
      AppointmentService.checkInAppointmentParent("appt_1", "intruder"),
    ).rejects.toThrow(new AppointmentServiceError("Not your appointment", 403));

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "REQUESTED" }),
    );
    await expect(
      AppointmentService.checkInAppointmentParent("appt_1", "parent_1"),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Only upcoming appointments can be checked in",
        400,
      ),
    );

    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  // -- update from PMS ------------------------------------------------------

  it("updateAppointmentPMS rejects a missing appointment and a non-updatable status", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      AppointmentService.updateAppointmentPMS("appt_1", {
        lead: { id: "vet_1" },
      } as never),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );

    (prisma.appointment.findUnique as jest.Mock).mockResolvedValueOnce(
      createPrismaAppointment({ status: "COMPLETED" }),
    );
    await expect(
      AppointmentService.updateAppointmentPMS("appt_1", {
        lead: { id: "vet_1" },
      } as never),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Appointment cannot be updated in status COMPLETED (updateAppointmentPMS)",
        409,
      ),
    );
  });

  it("updateAppointmentPMS rejects a slot the newly assigned vet already occupies", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue({
      id: "occ_1",
    });

    await expect(
      AppointmentService.updateAppointmentPMS("appt_1", {
        lead: { id: "vet_2", name: "Other Vet" },
      } as never),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Selected vet is not available for this slot",
        409,
      ),
    );
    expect(prisma.occupancy.create).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it("updateAppointmentPMS fails when the appointment disappears mid-update", async () => {
    (prisma.appointment.findUnique as jest.Mock)
      .mockResolvedValueOnce(createPrismaAppointment({ status: "UPCOMING" }))
      .mockResolvedValueOnce(null);

    await expect(
      AppointmentService.updateAppointmentPMS("appt_1", {
        lead: { id: "vet_1" },
      } as never),
    ).rejects.toThrow(
      new AppointmentServiceError("Appointment not found", 404),
    );
  });

  it("updateAppointmentPMS keeps the stored slot when no times are supplied and records a check-in", async () => {
    const row = createPrismaAppointment({
      status: "UPCOMING",
      concern: "Old concern",
      isEmergency: undefined,
    });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(row);
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "CHECKED_IN" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      status: "CHECKED_IN",
    } as never);

    expect(prisma.occupancy.deleteMany).not.toHaveBeenCalled();
    expect(prisma.occupancy.create).not.toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CHECKED_IN",
          lead: { id: "vet_1", name: "Vet" },
          appointmentDate: row.appointmentDate,
          timeSlot: row.timeSlot,
          startTime: row.startTime,
          endTime: row.endTime,
          durationMinutes: 60,
          concern: "Old concern",
          isEmergency: false,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "APPOINTMENT_CHECKED_IN",
        metadata: expect.objectContaining({
          previousStatus: "UPCOMING",
          concern: "Old concern",
        }),
      }),
    );
  });

  it("updateAppointmentPMS reports a generic reschedule for an in-progress transition", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "CHECKED_IN" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "IN_PROGRESS" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      status: "IN_PROGRESS",
    } as never);

    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "APPOINTMENT_RESCHEDULED",
        metadata: expect.objectContaining({
          previousStatus: "CHECKED_IN",
          status: "IN_PROGRESS",
          concern: undefined,
        }),
      }),
    );
  });

  it("updateAppointmentPMS rebooks the occupancy when an unassigned request is approved", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "NO_PAYMENT", lead: null }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1", name: "Dr Lead" },
      status: "UPCOMING",
    } as never);

    expect(prisma.occupancy.deleteMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org_1",
        sourceType: "APPOINTMENT",
        referenceId: "appt_1",
      },
    });
    expect(prisma.occupancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "vet_1" }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "APPOINTMENT_APPROVED" }),
    );
  });

  it("updateAppointmentPMS treats an extended end time as a reschedule and recomputes the duration", async () => {
    const row = createPrismaAppointment({ status: "UPCOMING" });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(row);
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1", name: "Dr Lead" },
      startTime: row.startTime,
      endTime: new Date("2026-01-01T11:30:00Z"),
    } as never);

    expect(prisma.occupancy.deleteMany).toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          durationMinutes: 90,
          endTime: new Date("2026-01-01T11:30:00Z"),
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "APPOINTMENT_RESCHEDULED" }),
    );
  });

  it("updateAppointmentPMS parses string timestamps, drops an invalid date and accepts minutesDuration", async () => {
    const row = createPrismaAppointment({ status: "UPCOMING", concern: null });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(row);
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      start: "2026-01-02T09:00:00Z",
      end: new Date("not-a-date"),
      minutesDuration: 25,
      description: "Follow up",
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: new Date("2026-01-02T09:00:00Z"),
          endTime: row.endTime,
          durationMinutes: 25,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "APPOINTMENT_RESCHEDULED" }),
    );
  });

  it("updateAppointmentPMS records a concern-only edit", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING", concern: "Old" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      concern: "New",
      durationMinutes: 40,
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ concern: "New", durationMinutes: 40 }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "APPOINTMENT_RESCHEDULED",
        metadata: expect.objectContaining({ concern: "New" }),
      }),
    );
  });

  it("updateAppointmentPMS records an emergency flag flip", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING", isEmergency: false }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING", isEmergency: true }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      isEmergency: true,
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEmergency: true }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "APPOINTMENT_RESCHEDULED" }),
    );
  });

  it("updateAppointmentPMS skips the audit trail when nothing changed", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalled();
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
  });

  // -- mobile booking -------------------------------------------------------

  it("createRequestedFromMobile requires a service selection", async () => {
    await expect(
      AppointmentService.createRequestedFromMobile({
        ...mobileDto(),
        appointmentType: undefined,
      } as never),
    ).rejects.toThrow(
      new AppointmentServiceError("serviceId is required", 400),
    );
  });

  it("createRequestedFromMobile fails when the organisation type cannot be resolved", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Unable to resolve organisation type for appointment booking.",
        404,
      ),
    );
    expect(CompanionOrganisationService.linkByParent).not.toHaveBeenCalled();
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("createRequestedFromMobile releases the reserved usage when the insert fails", async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "service_1",
      organisationId: "org_1",
      isActive: true,
      serviceType: "OBSERVATION_TOOL",
      observationToolId: "tool_1",
      name: "Pain scale",
      cost: 0,
    });
    (prisma.appointment.create as jest.Mock).mockRejectedValue(
      new Error("insert failed"),
    );

    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow("insert failed");

    expect(prisma.organizationUsageCounter.update).toHaveBeenLastCalledWith({
      where: { orgId: "org_1" },
      data: {
        appointmentsUsed: { decrement: 1 },
        toolsUsed: { decrement: 1 },
      },
    });
  });

  it("createRequestedFromMobile maps a non-package catalog selection and skips payment when the draft invoice has no id", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "prod_1",
      productKind: "SERVICE",
      name: "Dental",
      legacyServiceId: null,
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      finalAmount: 95,
      billingItems: [
        {
          name: "Dental clean",
          quantity: 2,
          unitPrice: 40,
          defaultDiscountPercent: 10,
        },
        {
          name: "Fluoride",
          quantity: 1,
          unitPrice: 15,
          defaultDiscountPercent: null,
        },
      ],
    });
    (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
    (
      InvoiceService.getOrCreateDraftForAppointment as jest.Mock
    ).mockResolvedValue({ totalAmount: 95 });

    const res = await AppointmentService.createRequestedFromMobile(
      mobileDto() as never,
    );

    // No legacy service row => no consent-form lookup and no observation task.
    expect(prisma.form.findFirst).not.toHaveBeenCalled();
    expect(TaskService.createCustom).not.toHaveBeenCalled();
    expect(InvoiceService.getOrCreateDraftForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            description: "Dental clean",
            quantity: 2,
            unitPrice: 40,
            discountPercent: 10,
          },
          {
            description: "Fluoride",
            quantity: 1,
            unitPrice: 15,
            discountPercent: undefined,
          },
        ],
      }),
    );
    expect(InvoiceService.setInvoiceDepositTarget).not.toHaveBeenCalled();
    expect(StripeService.createPaymentIntentForInvoice).not.toHaveBeenCalled();
    expect(res.paymentIntent).toBeUndefined();
  });

  it("createRequestedFromMobile falls back to the legacy service name for the invoice line", async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "service_1",
      organisationId: "org_1",
      isActive: true,
      serviceType: "STANDARD",
      name: "Wellness exam",
      cost: 42,
      maxDiscount: null,
    });

    await AppointmentService.createRequestedFromMobile({
      ...mobileDto(),
      appointmentType: { id: "service_1" },
    } as never);

    expect(InvoiceService.getOrCreateDraftForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            description: "Wellness exam",
            quantity: 1,
            unitPrice: 42,
            discountPercent: undefined,
          },
        ],
      }),
    );
  });

  it("createRequestedFromMobile falls back to a generic consultation line and queries consent forms unfiltered when the service id is blank", async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "",
      organisationId: "org_1",
      isActive: true,
      serviceType: "STANDARD",
      cost: 10,
      maxDiscount: 15,
    });

    await AppointmentService.createRequestedFromMobile({
      ...mobileDto(),
      appointmentType: { id: "service_1" },
    } as never);

    expect(prisma.form.findFirst).toHaveBeenCalledWith({
      where: {
        orgId: "org_1",
        status: "published",
        visibilityType: "External",
        category: "Consent",
      },
      orderBy: { updatedAt: "desc" },
    });
    expect(InvoiceService.getOrCreateDraftForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            description: "Consultation",
            quantity: 1,
            unitPrice: 10,
            discountPercent: 15,
          },
        ],
      }),
    );
  });

  it("createRequestedFromMobile treats a 404 consent-form lookup as no form but rethrows other failures", async () => {
    (prisma.form.findFirst as jest.Mock).mockRejectedValueOnce(
      new FormServiceError("no consent form", 404),
    );
    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).resolves.toBeDefined();

    (prisma.form.findFirst as jest.Mock).mockRejectedValueOnce(
      new Error("consent form store unavailable"),
    );
    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow("consent form store unavailable");
  });

  it("createRequestedFromMobile skips the observation task when the tool id is not a string", async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "service_1",
      organisationId: "org_1",
      isActive: true,
      serviceType: "OBSERVATION_TOOL",
      observationToolId: 42,
      name: "Pain scale",
      cost: 0,
    });

    await AppointmentService.createRequestedFromMobile(mobileDto() as never);

    expect(TaskService.createCustom).not.toHaveBeenCalled();
  });

  // -- free plan usage guards ----------------------------------------------

  it("rejects a free-plan booking when the usage counter row is missing", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      plan: "free",
    });
    (prisma.organizationUsageCounter.findUnique as jest.Mock).mockResolvedValue(
      null,
    );

    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow(
      new AppointmentServiceError("Usage counter missing", 500),
    );
  });

  it("rejects a free-plan booking once the appointment allowance is exhausted", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      plan: "free",
    });
    (prisma.organizationUsageCounter.findUnique as jest.Mock).mockResolvedValue(
      {
        orgId: "org_1",
        appointmentsUsed: 120,
        freeAppointmentsLimit: 120,
        toolsUsed: 0,
        freeToolsLimit: 200,
      },
    );

    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow(
      new AppointmentServiceError("Free plan appointment limit reached.", 403),
    );
    expect(prisma.organizationUsageCounter.update).not.toHaveBeenCalled();
  });

  it("rejects a free-plan observation booking once the tool allowance is exhausted", async () => {
    (prisma.service.findFirst as jest.Mock).mockResolvedValue({
      id: "service_1",
      organisationId: "org_1",
      isActive: true,
      serviceType: "OBSERVATION_TOOL",
      observationToolId: "tool_1",
      name: "Pain scale",
      cost: 0,
    });
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      plan: "free",
    });
    // Null counters must degrade to zero on both sides of each comparison.
    (prisma.organizationUsageCounter.findUnique as jest.Mock).mockResolvedValue(
      {
        orgId: "org_1",
        appointmentsUsed: null,
        freeAppointmentsLimit: null,
        toolsUsed: null,
        freeToolsLimit: null,
      },
    );

    await expect(
      AppointmentService.createRequestedFromMobile(mobileDto() as never),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Free plan observation tool appointment limit reached.",
        403,
      ),
    );
  });

  it("notifies the organisation the first time a free-plan limit is reached", async () => {
    (prisma.organizationBilling.findUnique as jest.Mock).mockResolvedValue({
      plan: "free",
    });
    (prisma.organizationUsageCounter.findUnique as jest.Mock).mockResolvedValue(
      {
        orgId: "org_1",
        appointmentsUsed: 4,
        freeAppointmentsLimit: 5,
        toolsUsed: 0,
        freeToolsLimit: 5,
        usersActiveCount: 0,
        freeUsersLimit: 10,
      },
    );
    (prisma.organizationUsageCounter.update as jest.Mock).mockResolvedValue({
      orgId: "org_1",
      appointmentsUsed: 5,
      freeAppointmentsLimit: 5,
      toolsUsed: 0,
      freeToolsLimit: 5,
      usersActiveCount: 0,
      freeUsersLimit: 10,
      freeLimitReachedAt: null,
    });
    (prisma.organizationUsageCounter.updateMany as jest.Mock).mockResolvedValue(
      { count: 1 },
    );

    await AppointmentService.createRequestedFromMobile(mobileDto() as never);

    expect(sendFreePlanLimitReachedEmail).toHaveBeenCalledWith({
      orgId: "org_1",
      usage: expect.objectContaining({ appointmentsUsed: 5 }),
    });
  });

  // -- PMS booking ----------------------------------------------------------

  it("createAppointmentFromPms completes the booking, notifies staff and emails the checkout link", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_pms", status: "UPCOMING" }),
    );
    (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({
      id: "inv_pms",
      totalAmount: 57,
      currency: "usd",
    });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        userId: "vet_1",
        email: "vet@example.com",
        firstName: "Ada",
        lastName: "Vet",
      },
    ]);
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      email: "Parent@Example.com",
      firstName: "Pat",
      lastName: "Parent",
    });

    const res = await AppointmentService.createAppointmentFromPms(
      pmsDto() as never,
      true,
      "PAYMENT_LINK",
    );

    expect(res.checkout).toEqual({ url: "https://checkout.example/abc" });
    expect(prisma.occupancy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "vet_1",
          referenceId: "appt_pms",
        }),
      }),
    );
    expect(NotificationService.sendToUser).toHaveBeenCalledWith(
      "parent_1",
      expect.objectContaining({ type: "APPOINTMENTS" }),
    );
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "vet@example.com",
        templateId: "appointmentAssigned",
        templateData: expect.objectContaining({
          employeeName: "Ada Vet",
          organisationName: "Happy Paws",
          appointmentType: "Consult",
        }),
      }),
    );
    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "parent@example.com",
        templateId: "appointmentPaymentCheckout",
        templateData: expect.objectContaining({
          parentName: "Pat Parent",
          organisationName: "Happy Paws",
          amountText: "USD 57.00",
          checkoutUrl: "https://checkout.example/abc",
          ctaLabel: "Pay Now",
        }),
      }),
    );
    expect(prisma.appointment.deleteMany).not.toHaveBeenCalled();
  });

  it("createAppointmentFromPms books an in-clinic package with its consent form and never opens a checkout session", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "prod_pkg",
      productKind: "PACKAGE",
      name: "Dental Bundle",
      legacyServiceId: "service_1",
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      finalAmount: 300,
      billingItems: [],
    });
    (prisma.form.findFirst as jest.Mock).mockResolvedValue({
      id: "form_consent",
    });
    (prisma.formVersion.findFirst as jest.Mock).mockResolvedValue({
      id: "fv_1",
    });
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        id: "appt_pkg",
        status: "UPCOMING",
        formIds: ["form_consent"],
      }),
    );

    const res = await AppointmentService.createAppointmentFromPms(
      { ...pmsDto(), formIds: [] } as never,
      false,
      "payment_at_clinic",
    );

    expect(res.checkout).toBeUndefined();
    expect(
      StripeService.createCheckoutSessionForInvoice,
    ).not.toHaveBeenCalled();
    expect(InvoiceService.createDraftForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentCollectionMethod: "PAYMENT_AT_CLINIC",
        items: [
          {
            description: "Dental Bundle",
            quantity: 1,
            unitPrice: 300,
            total: 300,
          },
        ],
      }),
    );
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productItemId: "prod_pkg",
          formIds: ["form_consent"],
          isEmergency: false,
          concern: undefined,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "FORM_ATTACHED",
        entityId: "form_consent",
      }),
    );
    // No user rows resolve for the lead, so no assignment email goes out.
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });

  it("createAppointmentFromPms skips checkout when the catalog-only draft invoice has no id", async () => {
    (CatalogService.resolveSelection as jest.Mock).mockResolvedValue({
      productItemId: "prod_1",
      productKind: "SERVICE",
      name: "Dental",
      legacyServiceId: null,
      isBookable: true,
      appointmentKinds: ["OUTPATIENT"],
      finalAmount: 50,
      billingItems: [
        {
          name: "Clean",
          quantity: 1,
          unitPrice: 50,
          defaultDiscountPercent: null,
        },
      ],
    });
    (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_cat", status: "UPCOMING" }),
    );
    (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({
      totalAmount: 50,
      currency: "usd",
    });

    await AppointmentService.createAppointmentFromPms(
      pmsDto() as never,
      true,
      "PAYMENT_LINK",
    );

    expect(prisma.form.findFirst).not.toHaveBeenCalled();
    expect(
      StripeService.createCheckoutSessionForInvoice,
    ).not.toHaveBeenCalled();
    expect(TaskService.createCustom).not.toHaveBeenCalled();
  });

  it("createAppointmentFromPms rejects a double-booked vet and releases the usage reservation", async () => {
    (prisma.occupancy.findFirst as jest.Mock).mockResolvedValue({
      id: "occ_1",
    });

    await expect(
      AppointmentService.createAppointmentFromPms(pmsDto() as never, false),
    ).rejects.toThrow(
      new AppointmentServiceError(
        "Selected vet is not available for this time slot.",
        409,
      ),
    );

    expect(prisma.appointment.create).not.toHaveBeenCalled();
    expect(prisma.appointment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.organizationUsageCounter.update).toHaveBeenLastCalledWith({
      where: { orgId: "org_1" },
      data: { appointmentsUsed: { decrement: 1 } },
    });
  });

  it("createAppointmentFromPms logs when the rollback cannot cancel the draft invoice", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_x", status: "UPCOMING" }),
    );
    (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({
      id: "inv_x",
      totalAmount: 10,
      currency: "usd",
    });
    (
      StripeService.createCheckoutSessionForInvoice as jest.Mock
    ).mockRejectedValue(new Error("stripe down"));
    (InvoiceService.updateStatus as jest.Mock).mockRejectedValue(
      new Error("invoice locked"),
    );

    await expect(
      AppointmentService.createAppointmentFromPms(
        pmsDto() as never,
        true,
        "PAYMENT_LINK",
      ),
    ).rejects.toThrow(
      new AppointmentServiceError("Unable to create appointment", 500),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to cancel PMS invoice after rollback.",
      expect.any(Error),
    );
    expect(prisma.appointment.deleteMany).toHaveBeenCalledWith({
      where: { id: "appt_x" },
    });
  });

  it("createAppointmentFromPms does not email a checkout link when the parent has no address on file", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_np", status: "UPCOMING" }),
    );
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({ email: null });

    await AppointmentService.createAppointmentFromPms(
      pmsDto() as never,
      true,
      "PAYMENT_LINK",
    );

    expect(prisma.parent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "parent_1" } }),
    );
    expect(sendEmailTemplate).not.toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "appointmentPaymentCheckout" }),
    );
  });

  it("createAppointmentFromPms logs and skips the checkout email when the stored parent address is invalid", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_bad", status: "UPCOMING" }),
    );
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      email: "not-an-email",
      firstName: "Pat",
      lastName: null,
    });

    await AppointmentService.createAppointmentFromPms(
      pmsDto() as never,
      true,
      "PAYMENT_LINK",
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Skipping checkout email for invalid parent email.",
      expect.any(Error),
    );
    expect(sendEmailTemplate).not.toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "appointmentPaymentCheckout" }),
    );
  });

  it("createAppointmentFromPms omits the amount and names it cannot resolve and survives mail failures", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_mail", status: "UPCOMING" }),
    );
    (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({
      id: "inv_mail",
      currency: "usd",
    });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        userId: "vet_1",
        email: "vet@example.com",
        firstName: null,
        lastName: null,
      },
    ]);
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      email: "parent@example.com",
      firstName: null,
      lastName: null,
    });
    (sendEmailTemplate as jest.Mock).mockRejectedValue(new Error("smtp down"));

    await AppointmentService.createAppointmentFromPms(
      pmsDto() as never,
      true,
      "PAYMENT_LINK",
    );

    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "appointmentPaymentCheckout",
        templateData: expect.objectContaining({
          parentName: undefined,
          amountText: undefined,
          organisationName: undefined,
        }),
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send appointment assignment email.",
      expect.any(Error),
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send appointment checkout email.",
      expect.any(Error),
    );
  });

  it("createAppointmentFromPms survives a failure while preparing the staff assignment emails", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_staff", status: "UPCOMING" }),
    );
    (prisma.user.findMany as jest.Mock).mockRejectedValue(
      new Error("user lookup failed"),
    );

    await expect(
      AppointmentService.createAppointmentFromPms(pmsDto() as never, false),
    ).resolves.toBeDefined();

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to prepare appointment assignment emails.",
      expect.any(Error),
    );
  });

  it("createAppointmentFromPms names the booked room in the assignment email", async () => {
    (prisma.appointment.create as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ id: "appt_room", status: "UPCOMING" }),
    );
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        userId: "vet_1",
        email: "vet@example.com",
        firstName: "Ada",
        lastName: "Vet",
      },
    ]);

    await AppointmentService.createAppointmentFromPms(
      { ...pmsDto(), room: { id: "room_1", name: "Consult Room 1" } } as never,
      false,
    );

    expect(sendEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "appointmentAssigned",
        templateData: expect.objectContaining({
          locationName: "Consult Room 1",
        }),
      }),
    );
  });

  // -- remaining conditional arms -------------------------------------------

  it("updateAppointmentPMS ignores an unparseable timestamp string", async () => {
    const row = createPrismaAppointment({ status: "UPCOMING" });
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(row);
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      startTime: "definitely not a timestamp",
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: row.startTime,
          endTime: row.endTime,
          durationMinutes: row.durationMinutes,
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
  });

  it("updateAppointmentPMS keeps the stored status when the payload names one the extractor drops", async () => {
    (fromAppointmentRequestDTO as jest.Mock).mockImplementationOnce(
      (dto: Record<string, unknown>) => ({
        ...dto,
        status: undefined,
        patient: dto.patient ?? dto.companion,
      }),
    );
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.updateAppointmentPMS("appt_1", {
      lead: { id: "vet_1" },
      status: "CHECKED_IN",
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "UPCOMING" }),
      }),
    );
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
  });

  it("approveRequestedFromPms resolves referenced support staff and room participants", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "UPCOMING" }),
    );

    await AppointmentService.approveRequestedFromPms("appt_1", {
      participant: [
        {
          type: [{ coding: [{ code: "PPRF" }] }],
          actor: { reference: "Practitioner/vet_1", display: "Dr Lead" },
        },
        {
          type: [{ coding: [{ code: "SPRF" }] }],
          actor: { reference: "Practitioner/staff_1", display: "Nurse Joy" },
        },
        {
          type: [{ coding: [{ code: "LOC" }] }],
          actor: { reference: "Location/room_1", display: "Consult Room 1" },
        },
      ],
    } as never);

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supportStaff: [{ id: "staff_1", name: "Nurse Joy" }],
          room: { id: "room_1", name: "Consult Room 1" },
        }),
      }),
    );
  });

  it("rescheduleFromParent clears a null support staff column explicitly", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      createPrismaAppointment({
        status: "REQUESTED",
        supportStaff: null,
        room: { id: "room_1" },
      }),
    );
    (prisma.appointment.update as jest.Mock).mockResolvedValue(
      createPrismaAppointment({ status: "REQUESTED" }),
    );

    await AppointmentService.rescheduleFromParent("appt_1", "parent_1", {
      startTime: new Date("2026-02-01T10:00:00Z"),
      endTime: new Date("2026-02-01T11:00:00Z"),
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supportStaff: Prisma.DbNull,
          room: { id: "room_1" },
          durationMinutes: 60,
        }),
      }),
    );
  });
});
