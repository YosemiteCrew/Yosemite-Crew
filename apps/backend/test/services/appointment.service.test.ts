import mongoose, { Types } from "mongoose";
import {
  AppointmentService,
  AppointmentServiceError,
} from "../../src/services/appointment.service";
import AppointmentModel from "../../src/models/appointment";
import ServiceModel from "src/models/service";
import { InvoiceService } from "../../src/services/invoice.service";
import { StripeService } from "../../src/services/stripe.service";
import { OccupancyModel } from "src/models/occupancy";
import OrganizationModel from "src/models/organization";
import UserProfileModel from "src/models/user-profile";
import UserModel from "src/models/user";
import { ParentModel } from "src/models/parent";
import { NotificationService } from "../../src/services/notification.service";
import { TaskService } from "../../src/services/task.service";
import { FormService, FormServiceError } from "../../src/services/form.service";
import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";
import { sendEmailTemplate } from "src/utils/email";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { FormModel } from "src/models/form";
import { prisma } from "src/config/prisma";

// --- Global Mocks Setup ---

jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  fromAppointmentRequestDTO: jest.fn((dto) => dto),
  toAppointmentResponseDTO: jest.fn((obj) => obj),
}));

jest.mock("../../src/services/invoice.service", () => ({
  InvoiceService: {
    createDraftForAppointment: jest.fn(),
    getOrCreateDraftForAppointment: jest.fn(),
    handleAppointmentCancellation: jest.fn(),
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

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

// Mongoose Models Mocking
jest.mock("../../src/models/appointment", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

jest.mock("src/models/service", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("src/models/occupancy", () => ({
  __esModule: true,
  OccupancyModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
}));
jest.mock("src/models/invoice", () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    find: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("src/models/organization", () => ({
  __esModule: true,
  default: { findById: jest.fn(), find: jest.fn() },
}));
jest.mock("src/models/user-profile", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock("src/models/user", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock("src/models/parent", () => ({
  __esModule: true,
  ParentModel: { findById: jest.fn() },
}));
jest.mock("src/models/organization.billing", () => ({
  __esModule: true,
  OrgBilling: { findOne: jest.fn() },
}));
jest.mock("src/models/organisation.usage.counter", () => ({
  __esModule: true,
  OrgUsageCounters: {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("src/models/form", () => ({
  __esModule: true,
  FormModel: { find: jest.fn() },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    service: { findFirst: jest.fn() },
    appointment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    invoice: { findMany: jest.fn() },
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
  },
}));

// Transaction Mocks
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
};
jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);

// Query Chain Factory to handle .session().lean().sort() etc without TDZ issues
const createQueryChain = (resolvedValue: any) => {
  const p = Promise.resolve(resolvedValue);
  (p as any).select = jest.fn().mockReturnValue(p);
  (p as any).lean = jest.fn().mockResolvedValue(resolvedValue);
  (p as any).sort = jest.fn().mockReturnValue(p);
  (p as any).session = jest.fn().mockReturnValue(p);
  (p as any).exec = jest.fn().mockResolvedValue(resolvedValue);
  return p;
};

// Unified helper to construct robust mock Mongoose documents to prevent "toObject" mapping crashes
const createMockDoc = (overrides = {}) => {
  const baseId = new Types.ObjectId();
  const data = {
    _id: baseId,
    organisationId: baseId,
    companion: {
      id: baseId.toString(),
      parent: { id: baseId.toString() },
      name: "Pet",
    },
    lead: { id: baseId.toString(), name: "Vet" },
    supportStaff: [],
    room: { id: baseId.toString(), name: "Room 1" },
    appointmentType: { id: baseId.toString(), name: "Consult" },
    startTime: new Date("2026-01-01T10:00:00Z"),
    endTime: new Date("2026-01-01T11:00:00Z"),
    status: "UPCOMING",
    formIds: [],
    attachments: [],
    concern: undefined as string | undefined, // Fixed TS "concern does not exist"
    ...overrides,
  };
  return {
    ...data,
    toObject: () => data,
    save: jest.fn().mockResolvedValue(true),
  };
};

const createPrismaAppointment = (overrides: Partial<any> = {}) => ({
  id: "appt_1",
  companion: { id: "comp_1", parent: { id: "parent_1" }, name: "Pet" },
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
  const validId = new Types.ObjectId().toHexString();
  const validObjId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.READ_FROM_POSTGRES = "false";
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma),
    );
  });

  describe("AppointmentServiceError & ensureObjectId", () => {
    it("should configure error properties correctly", () => {
      const err = new AppointmentServiceError("Test", 400);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("AppointmentServiceError");
    });

    it("ensureObjectId throws on invalid string", async () => {
      await expect(AppointmentService.getById("invalid")).rejects.toThrow(
        new AppointmentServiceError("Invalid AppointmentId", 400),
      );
    });
  });

  describe("createRequestedFromMobile", () => {
    const baseDto = {
      organisationId: validId,
      companion: { id: validId, parent: { id: validId } },
      appointmentType: { id: validId },
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

    it("should throw 404 if service is invalid", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow(
        new AppointmentServiceError("Invalid service selected", 404),
      );
    });

    it("should throw 403 if free plan limit reached", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({
        serviceType: "STANDARD",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null); // simulate limit reached
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "free" }),
      );
      (OrgUsageCounters.findOne as jest.Mock).mockResolvedValue({
        appointmentsUsed: 10,
        freeAppointmentsLimit: 10,
      });

      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Free plan appointment limit reached.",
          403,
        ),
      );
    });

    it("should catch FormService exceptions safely unless 404", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({
        serviceType: "STANDARD",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({}); // usage ok
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );

      // Simulate a hard DB crash in FormService
      (FormService.getConsentFormForParent as jest.Mock).mockRejectedValue(
        new Error("Hard crash"),
      );

      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow(new Error("Hard crash"));
    });

    it("should handle 404 FormServiceError safely and create appointment successfully", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({
        serviceType: "OBSERVATION_TOOL",
        observationToolId: validId,
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
        appointmentsUsed: 1,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );

      // 404 should be caught and ignored
      (FormService.getConsentFormForParent as jest.Mock).mockRejectedValue(
        new FormServiceError("Not Found", 404),
      );

      const mockCreated = createMockDoc({ status: "NO_PAYMENT" });
      (AppointmentModel.create as jest.Mock).mockResolvedValue(mockCreated);
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_123" });
      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue("pi_123");

      const res = await AppointmentService.createRequestedFromMobile(
        baseDto as any,
      );

      expect(res.paymentIntent).toBe("pi_123");
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(TaskService.createCustom).toHaveBeenCalled(); // Because OBSERVATION_TOOL
    });

    it("should release usage reservation if creation fails", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({
        serviceType: "STANDARD",
      });
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
        appointmentsUsed: 1,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(
        null,
      );

      (AppointmentModel.create as jest.Mock).mockRejectedValue(
        new Error("DB failure"),
      );

      await expect(
        AppointmentService.createRequestedFromMobile(baseDto as any),
      ).rejects.toThrow("DB failure");
      expect(OrgUsageCounters.updateOne).toHaveBeenCalled(); // release limit called
    });
  });

  describe("createAppointmentFromPms", () => {
    const basePmsDto = {
      organisationId: validId,
      companion: { id: validId, parent: { id: validId }, name: "Pet" },
      appointmentType: { id: validId, name: "Consult" },
      lead: { id: validId, name: "Dr. Smith" },
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

    it("should throw 404 if service not found", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );
      await expect(
        AppointmentService.createAppointmentFromPms(basePmsDto as any, false),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Invalid or inactive service for this organisation.",
          404,
        ),
      );
    });

    it("should throw 409 if overlapping occupancy", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ cost: 100 }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue({
        id: "form1",
      });

      // Simulate overlap
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ _id: "occ1" }),
      );

      await expect(
        AppointmentService.createAppointmentFromPms(basePmsDto as any, false),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Selected vet is not available for this time slot.",
          409,
        ),
      );

      expect(mockSession.abortTransaction).toHaveBeenCalled();
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

    it("should accept valid payment collection methods (case-insensitive)", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({
          cost: 100,
          serviceType: "STANDARD",
        }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(
        null,
      );
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );

      const mockAppt = createMockDoc({
        companion: basePmsDto.companion,
        lead: basePmsDto.lead,
        appointmentType: basePmsDto.appointmentType,
      });
      (AppointmentModel.create as jest.Mock).mockResolvedValue([mockAppt]);
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue(
        { _id: validObjId, totalAmount: 100, currency: "usd" },
      );

      const res = await AppointmentService.createAppointmentFromPms(
        basePmsDto as any,
        false,
        "payment_link",
      );

      expect(res).toBeDefined();
    });

    it("should create successfully, handle email branches, and return data", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({
          cost: 100,
          serviceType: "OBSERVATION_TOOL",
          observationToolId: { _id: validObjId },
        }),
      ); // Hitting observationTool object branch
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(
        null,
      );
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      ); // No overlap

      const mockAppt = createMockDoc({
        formIds: ["f1"],
        companion: basePmsDto.companion,
        lead: basePmsDto.lead,
        appointmentType: basePmsDto.appointmentType,
      });
      (AppointmentModel.create as jest.Mock).mockResolvedValue([mockAppt]);
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue(
        { _id: validObjId, totalAmount: 100, currency: "usd" },
      );

      (
        StripeService.createCheckoutSessionForInvoice as jest.Mock
      ).mockResolvedValue({ url: "http://checkout.link" });
      (ParentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain({ email: "test@test.com", firstName: "John" }),
      ); // Testing buildDisplayName branch

      // Testing organisation name branches
      (OrganizationModel.findById as jest.Mock).mockReturnValue(
        createQueryChain({ name: "OrgName" }),
      );
      (UserModel.find as jest.Mock).mockReturnValue(
        createQueryChain([
          { userId: validId, email: "vet@vet.com" },
          { userId: "s1", email: "nurse@vet.com" },
        ]),
      );

      const res = await AppointmentService.createAppointmentFromPms(
        basePmsDto as any,
        true,
      ); // createPayment = true

      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(StripeService.createCheckoutSessionForInvoice).toHaveBeenCalled();
      expect(TaskService.createCustom).toHaveBeenCalled(); // Observation tool
      expect(sendEmailTemplate).toHaveBeenCalled(); // Checkout email & Assignment emails
      expect((res as any).appointment.id).toBeDefined();
    });

    it("should continue when organisation lookup does not support select()", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({
          cost: 100,
          serviceType: "STANDARD",
        }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue({
        _id: validId,
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(
        null,
      );
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );

      const mockAppt = createMockDoc({
        companion: basePmsDto.companion,
        lead: basePmsDto.lead,
        appointmentType: basePmsDto.appointmentType,
      });
      (AppointmentModel.create as jest.Mock).mockResolvedValue([mockAppt]);
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue(
        { _id: validObjId, totalAmount: 100, currency: "usd" },
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue({}); // no select()

      const res = await AppointmentService.createAppointmentFromPms(
        basePmsDto as any,
        false,
      );

      expect(res).toBeDefined();
    });
  });

  describe("cancelAppointment (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

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
    it("returns PAID when all invoices are paid (mongo)", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(
        createMockDoc({ _id: validObjId }),
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const aggregate = require("src/models/invoice").default
        .aggregate as jest.Mock;
      aggregate.mockResolvedValueOnce([
        { _id: validObjId.toString(), hasPaid: 1, hasUnpaid: 0 },
      ]);

      const res = await AppointmentService.getById(validObjId.toString());
      expect((res as any).paymentStatus).toBe("PAID");
    });

    it("returns UNPAID when unpaid invoices exist (postgres)", async () => {
      process.env.READ_FROM_POSTGRES = "true";
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

    it("returns empty list without invoice lookup when no rows (postgres)", async () => {
      process.env.READ_FROM_POSTGRES = "true";
      (prisma.appointment.findMany as jest.Mock).mockResolvedValueOnce([]);

      const res = await AppointmentService.getAppointmentsForParent("parent_1");
      expect(res).toEqual([]);
      expect(prisma.invoice.findMany).not.toHaveBeenCalled();
    });
  });

  describe("createRequestedFromMobile (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

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
      ).mockResolvedValue({ id: "inv_1" });
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

      expect(prisma.appointment.create).toHaveBeenCalled();
      expect(prisma.organizationUsageCounter.update).toHaveBeenCalled();
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
      ).mockResolvedValue({ id: "inv_2" });
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

  describe("createRequestedFromMobile (mongo)", () => {
    it("should throw when free plan observation tool limit reached", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      (ServiceModel.findOne as jest.Mock).mockResolvedValueOnce({
        serviceType: "OBSERVATION_TOOL",
        observationToolId: { _id: validId },
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "free" }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock)
        .mockResolvedValueOnce({ _id: validId }) // ensureOrgUsageCounters
        .mockResolvedValueOnce(null); // reserveAppointmentUsage (limit reached)
      (OrgUsageCounters.findOne as jest.Mock).mockResolvedValueOnce({
        toolsUsed: 5,
        freeToolsLimit: 5,
        appointmentsUsed: 0,
        freeAppointmentsLimit: 10,
      });

      await expect(
        AppointmentService.createRequestedFromMobile({
          organisationId: validId,
          companion: { id: validId, parent: { id: validId } },
          appointmentType: { id: validId, name: "Obs" },
          startTime,
          endTime,
          durationMinutes: 30,
        } as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Free plan observation tool appointment limit reached.",
          403,
        ),
      );

      expect(FormService.getConsentFormForParent).not.toHaveBeenCalled();
    });

    it("should create observation tool task when observationToolId is object", async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      const toolId = new Types.ObjectId();

      (ServiceModel.findOne as jest.Mock).mockResolvedValueOnce({
        serviceType: "OBSERVATION_TOOL",
        observationToolId: { _id: toolId },
      });
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ plan: "pro" }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValueOnce({
        _id: validId,
        appointmentsUsed: 1,
      });
      (FormService.getConsentFormForParent as jest.Mock).mockResolvedValue(
        null,
      );

      const mockCreated = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.create as jest.Mock).mockResolvedValue(mockCreated);
      (
        InvoiceService.getOrCreateDraftForAppointment as jest.Mock
      ).mockResolvedValue({ id: "inv_4" });
      (
        StripeService.createPaymentIntentForInvoice as jest.Mock
      ).mockResolvedValue("pi_123");

      await AppointmentService.createRequestedFromMobile({
        organisationId: validId,
        companion: { id: validId, parent: { id: validId }, name: "Pet" },
        appointmentType: { id: validId, name: "Obs" },
        startTime,
        endTime,
        durationMinutes: 30,
      } as any);

      expect(TaskService.createCustom).toHaveBeenCalledWith(
        expect.objectContaining({
          observationToolId: toolId.toString(),
        }),
      );
    });
  });

  describe("getAppointmentsForOrganisation (postgres)", () => {
    const originalReadFromPostgres = process.env.READ_FROM_POSTGRES;

    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

    afterEach(() => {
      process.env.READ_FROM_POSTGRES = originalReadFromPostgres;
    });

    it("should throw when organisationId missing", async () => {
      await expect(
        AppointmentService.getAppointmentsForOrganisation("" as any),
      ).rejects.toThrow(
        new AppointmentServiceError("organisationId is required", 400),
      );
    });

    it("should map payment status for rows", async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { prisma } = require("src/config/prisma");
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

      prisma.appointment.findMany.mockResolvedValueOnce([row]);
      prisma.invoice.findMany.mockResolvedValueOnce([
        { appointmentId: "appt_1", status: "PAID" },
      ]);

      const results =
        await AppointmentService.getAppointmentsForOrganisation("org_1");

      expect((results[0] as any)?.paymentStatus).toBe("PAID");
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
        AppointmentService.approveRequestedFromPms(validId, {
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
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.approveRequestedFromPms(validId, fhir as any),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Requested appointment not found or already processed",
          404,
        ),
      );
    });

    it("should successfully approve, extract FHIR fields, update occupancy and notify", async () => {
      // FHIR with Lead, Support Staff, and Room to hit all extract branches
      const fhir = {
        participant: [
          {
            type: [{ coding: [{ code: "PPRF" }] }],
            actor: { reference: "Practitioner/vet1", display: "Vet1" },
          },
          {
            type: [{ coding: [{ code: "SPRF" }] }],
            actor: { reference: "Practitioner/sup1", display: "Sup1" },
          },
          {
            type: [{ coding: [{ code: "LOC" }] }],
            actor: { reference: "Location/loc1", display: "Room1" },
          },
        ],
      };

      const mockAppt: any = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null); // Fallback profile Url test

      // Simulate `typeof OrganizationModel.findById !== "function"` logic in helper
      const originalFindById = OrganizationModel.findById;
      (OrganizationModel as any).findById = "not-a-function";

      const res = await AppointmentService.approveRequestedFromPms(
        validId,
        fhir as any,
      );

      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(mockAppt.status).toBe("UPCOMING");
      expect(mockAppt.lead.id).toBe("vet1");
      expect(mockAppt.save).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
      expect((res as any).id).toBeDefined();

      // Restore original
      OrganizationModel.findById = originalFindById;
    });

    it("should handle transaction aborts safely", async () => {
      const fhir = {
        participant: [
          {
            type: [{ coding: [{ code: "PPRF" }] }],
            actor: { reference: "Practitioner/vet1" },
          },
        ],
      };
      const mockAppt = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ _id: "overlap" }),
      ); // Triggers 409

      await expect(
        AppointmentService.approveRequestedFromPms(validId, fhir as any),
      ).rejects.toThrow();
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe("cancelAppointment", () => {
    it("should throw 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );
      await expect(
        AppointmentService.cancelAppointment(validId),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment not found", 404),
      );
    });

    it("should return early if already CANCELLED", async () => {
      const mockDoc = createMockDoc({ status: "CANCELLED" });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain(mockDoc),
      );
      const res = await AppointmentService.cancelAppointment(validId);
      expect((res as any).status).toBe("CANCELLED");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it("should successfully cancel, handle invoice, and delete occupancy", async () => {
      const mockDoc = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain(mockDoc),
      );
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(
        createQueryChain(true),
      );

      await AppointmentService.cancelAppointment(validId, "No show");

      expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalledWith(
        validId,
        "No show",
      );
      expect(mockDoc.status).toBe("CANCELLED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("cancelAppointmentFromParent", () => {
    it("should throw 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.cancelAppointmentFromParent(validId, validId, "r"),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment not found", 404),
      );
    });

    it("should throw 403 if parentId mismatches", async () => {
      const mockDoc = createMockDoc({ companion: { parent: { id: "other" } } });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await expect(
        AppointmentService.cancelAppointmentFromParent(validId, validId, "r"),
      ).rejects.toThrow(
        new AppointmentServiceError("Not your appointment", 403),
      );
    });

    it("should throw 400 if status is not cancellable", async () => {
      const mockDoc = createMockDoc({
        companion: { parent: { id: validId } },
        status: "COMPLETED",
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await expect(
        AppointmentService.cancelAppointmentFromParent(validId, validId, "r"),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Only requested or upcoming appointments can be cancelled",
          400,
        ),
      );
    });

    it("should throw 400 if invoice cancellation fails", async () => {
      const mockDoc = createMockDoc({
        companion: { parent: { id: validId } },
        status: "UPCOMING",
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(null);
      await expect(
        AppointmentService.cancelAppointmentFromParent(validId, validId, "r"),
      ).rejects.toThrow(
        new AppointmentServiceError("Not able to cancle appointment", 400),
      ); // Typo matching source code
    });

    it("should successfully cancel appointment", async () => {
      const mockDoc = createMockDoc({
        companion: { parent: { id: validId } },
        status: "UPCOMING",
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);

      await AppointmentService.cancelAppointmentFromParent(
        validId,
        validId,
        "reason",
      );

      expect(mockDoc.status).toBe("CANCELLED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
    });
  });

  describe("rejectRequestedAppointment", () => {
    it("should throw 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.rejectRequestedAppointment(validId),
      ).rejects.toThrow(
        new AppointmentServiceError("Appointment not found.", 404),
      );
    });

    it("should throw 400 if not REQUESTED", async () => {
      const mockDoc = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await expect(
        AppointmentService.rejectRequestedAppointment(validId),
      ).rejects.toThrow(
        new AppointmentServiceError(
          "Only REQUESTED appointments can be rejected.",
          400,
        ),
      );
    });

    it("should reject successfully and default reason", async () => {
      const mockDoc: any = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);

      await AppointmentService.rejectRequestedAppointment(validId); // no reason passed
      expect(mockDoc.status).toBe("CANCELLED");
      expect(mockDoc.concern).toBe("Rejected by organisation"); // default fallback
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });
  });

  describe("updateAppointmentPMS", () => {
    it("should throw 400 if id missing", async () => {
      await expect(
        AppointmentService.updateAppointmentPMS("", {} as any),
      ).rejects.toThrow();
    });

    it("should throw 400 if lead is missing", async () => {
      await expect(
        AppointmentService.updateAppointmentPMS(validId, {
          lead: undefined,
        } as any),
      ).rejects.toThrow();
    });

    it("should throw 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.updateAppointmentPMS(validId, {
          lead: { id: "l1" },
        } as any),
      ).rejects.toThrow();
    });

    it("should update occupancy and appointment fields safely", async () => {
      const oldTime = new Date("2026-01-01");
      const newTime = new Date("2026-01-02");
      const mockDoc: any = createMockDoc({
        status: "UPCOMING",
        lead: { id: "old_lead" },
        startTime: oldTime,
        endTime: oldTime,
      });

      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain(null),
      );

      await AppointmentService.updateAppointmentPMS(validId, {
        lead: { id: "new_lead" },
        startTime: newTime,
        endTime: newTime,
      } as any);

      expect(OccupancyModel.deleteMany).toHaveBeenCalled(); // Triggered because vet/time changed
      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(mockDoc.lead.id).toBe("new_lead");
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("attachFormsToAppointment", () => {
    it("should throw 400 for bad parameters", async () => {
      await expect(
        AppointmentService.attachFormsToAppointment("", ["f1"]),
      ).rejects.toThrow("Appointment ID is required");
      await expect(
        AppointmentService.attachFormsToAppointment(validId, []),
      ).rejects.toThrow("formIds are required");
      await expect(
        AppointmentService.attachFormsToAppointment(validId, ["  "]),
      ).rejects.toThrow("formIds are required"); // empty after trim
    });

    it("should throw 404 if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.attachFormsToAppointment(validId, [validId]),
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw 404 if some forms missing", async () => {
      const mockDoc = createMockDoc();
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      (FormModel.find as jest.Mock).mockReturnValue(createQueryChain([])); // found 0 forms
      await expect(
        AppointmentService.attachFormsToAppointment(validId, [validId]),
      ).rejects.toThrow(/Forms not found:/);
    });

    it("should return unmodified doc if all forms already attached", async () => {
      const mockDoc = createMockDoc({ formIds: [validId] });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      // Ensure the returned ID explicitly matches validId so it successfully clears the "missing forms" check
      (FormModel.find as jest.Mock).mockReturnValue(
        createQueryChain([{ _id: new Types.ObjectId(validId) }]),
      );

      await AppointmentService.attachFormsToAppointment(validId, [validId]);
      expect(AppointmentModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should attach new forms successfully", async () => {
      const mockDoc = createMockDoc({ formIds: [] });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      // Ensure the returned ID explicitly matches validId so it successfully clears the "missing forms" check
      (FormModel.find as jest.Mock).mockReturnValue(
        createQueryChain([{ _id: new Types.ObjectId(validId) }]),
      );

      const updatedDoc = createMockDoc({ formIds: [validId] });
      (AppointmentModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        updatedDoc,
      );

      await AppointmentService.attachFormsToAppointment(validId, [validId]);
      expect(AppointmentModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalled();
    });
  });

  describe("checkInAppointment & checkInAppointmentParent", () => {
    it("checkInAppointmentParent: should throw if mismatch or invalid state", async () => {
      const mockDoc = createMockDoc({ companion: { parent: { id: "other" } } });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await expect(
        AppointmentService.checkInAppointmentParent(validId, validId),
      ).rejects.toThrow("Not your appointment");

      const mockDoc2 = createMockDoc({
        companion: { parent: { id: validId } },
        status: "COMPLETED",
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc2);
      await expect(
        AppointmentService.checkInAppointmentParent(validId, validId),
      ).rejects.toThrow("Only upcoming appointments can be checked in");
    });

    it("checkInAppointmentParent: should check in successfully", async () => {
      const mockDoc = createMockDoc({
        status: "UPCOMING",
        companion: { parent: { id: validId } },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await AppointmentService.checkInAppointmentParent(validId, validId);
      expect(mockDoc.status).toBe("CHECKED_IN");
    });

    it("checkInAppointment: should check in successfully", async () => {
      const mockDoc = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      await AppointmentService.checkInAppointment(validId);
      expect(mockDoc.status).toBe("CHECKED_IN");
    });
  });

  describe("rescheduleFromParent", () => {
    const validChanges = {
      startTime: new Date(),
      endTime: new Date(Date.now() + 100000),
      durationMinutes: 30,
      concern: "c",
      isEmergency: true,
    };

    it("should throw 400 for invalid dates", async () => {
      await expect(
        AppointmentService.rescheduleFromParent(validId, validId, {
          startTime: "invalid",
          endTime: "invalid",
        }),
      ).rejects.toThrow("Invalid startTime/endTime");

      await expect(
        AppointmentService.rescheduleFromParent(validId, validId, {
          startTime: new Date(Date.now() + 100000),
          endTime: new Date(),
        }),
      ).rejects.toThrow("startTime must be before endTime");
    });

    it("should throw 403 if parent mismatch", async () => {
      const mockDoc = createMockDoc({ companion: { parent: { id: "other" } } });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain(mockDoc),
      );
      await expect(
        AppointmentService.rescheduleFromParent(validId, validId, validChanges),
      ).rejects.toThrow("You are not allowed to modify this appointment.");
    });

    it("should convert UPCOMING to REQUESTED and remove occupancy safely", async () => {
      const mockDoc: any = createMockDoc({
        status: "UPCOMING",
        companion: { parent: { id: validId } },
      });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(
        createQueryChain(mockDoc),
      );
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(
        createQueryChain(true),
      );

      await AppointmentService.rescheduleFromParent(
        validId,
        validId,
        validChanges,
      );

      expect(mockDoc.status).toBe("REQUESTED");
      expect(mockDoc.lead).toBeUndefined(); // Cleared
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
    });
  });

  describe("Fetch and List Methods", () => {
    it("getAppointmentsForCompanion: handles empty and maps orgs", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        createQueryChain([]),
      );
      expect(
        await AppointmentService.getAppointmentsForCompanion(validId),
      ).toEqual([]);

      const mockDoc = createMockDoc();
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        createQueryChain([mockDoc]),
      );
      (OrganizationModel.find as jest.Mock).mockReturnValue(
        createQueryChain([{ _id: mockDoc.organisationId, name: "Org" }]),
      );

      const res = await AppointmentService.getAppointmentsForCompanion(validId);
      expect(res[0]?.organisation?.name).toBe("Org");
    });

    it("other filters (ForCompanionByOrg, ForParent, ForOrg, ForLead, ForStaff, ByDate, Search) return mapped dtos", async () => {
      const mockDoc = createMockDoc();
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        createQueryChain([mockDoc]),
      );

      expect(
        await AppointmentService.getAppointmentsForCompanionByOrganisation(
          validId,
          validId,
        ),
      ).toHaveLength(1);
      expect(
        await AppointmentService.getAppointmentsForParent(validId),
      ).toHaveLength(1);
      expect(
        await AppointmentService.getAppointmentsForOrganisation(validId, {
          status: ["UPCOMING"],
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).toHaveLength(1);
      expect(
        await AppointmentService.getAppointmentsForLead(validId, validId),
      ).toHaveLength(1);
      expect(
        await AppointmentService.getAppointmentsForSupportStaff(
          validId,
          validId,
        ),
      ).toHaveLength(1);
      expect(
        await AppointmentService.getAppointmentsByDateRange(
          validId,
          new Date(),
          new Date(),
          ["UPCOMING"],
        ),
      ).toHaveLength(1);
      expect(
        await AppointmentService.searchAppointments({
          status: ["UPCOMING"],
          startDate: new Date(),
          endDate: new Date(),
        }),
      ).toHaveLength(1);
    });
  });

  describe("Fetch and List Guards", () => {
    it("throws on missing identifiers", async () => {
      await expect(
        AppointmentService.getAppointmentsForCompanionByOrganisation("", "org"),
      ).rejects.toThrow(
        new AppointmentServiceError("companionId is required", 400),
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
    beforeEach(() => {
      process.env.READ_FROM_POSTGRES = "true";
    });

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
      expect(res).toBeDefined();
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
      } as any);

      expect(prisma.occupancy.create).toHaveBeenCalled();
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

      await AppointmentService.attachFormsToAppointment("appt_1", ["form_1"]);

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
        companionId: "comp_1",
        parentId: "parent_1",
        leadId: "vet_1",
        staffId: "staff_1",
      });

      expect(res).toHaveLength(1);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ AND: expect.any(Array) }),
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

  describe("markNoShowAppointments", () => {
    it("should call updateMany with correct cutoff logic", async () => {
      (AppointmentModel.updateMany as jest.Mock).mockResolvedValue({
        matchedCount: 5,
        modifiedCount: 3,
      });
      const res = await AppointmentService.markNoShowAppointments({
        graceMinutes: 10,
      });
      expect(AppointmentModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "UPCOMING",
          endTime: expect.any(Object),
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ status: "NO_SHOW" }),
        }),
      );
      expect(res.modified).toBe(3);
    });
  });
});
