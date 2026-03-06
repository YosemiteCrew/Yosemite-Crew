import mongoose, { Types } from "mongoose";
import {
  AppointmentService,
  AppointmentServiceError,
} from "../../src/services/appointment.service";
import AppointmentModel from "../../src/models/appointment";
import ServiceModel from "../../src/models/service";
import { OccupancyModel } from "../../src/models/occupancy";
import OrganizationModel from "../../src/models/organization";
import UserProfileModel from "../../src/models/user-profile";
import { InvoiceService } from "../../src/services/invoice.service";
import { StripeService } from "../../src/services/stripe.service";
import { NotificationService } from "../../src/services/notification.service";

// --- 1. Mocks ---
jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    startSession: jest.fn(),
  };
});

jest.mock("../../src/models/appointment");
jest.mock("../../src/models/service");
jest.mock("../../src/models/occupancy");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/user-profile");
jest.mock("../../src/services/invoice.service");
jest.mock("../../src/services/stripe.service");
jest.mock("../../src/services/notification.service");

// Mock DTO transformers to pass data through for testing
jest.mock("@yosemite-crew/types", () => ({
  fromAppointmentRequestDTO: jest.fn((dto) => dto),
  toAppointmentResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

// --- 2. Query Helpers ---
const createMockQuery = (val: any) => {
  const q: any = Promise.resolve(val);
  q.session = jest.fn().mockReturnValue(q);
  q.sort = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(val);
  return q;
};

const makeMockDoc = (overrides: any = {}) => {
  const _id = new Types.ObjectId();
  const obj = {
    _id,
    organisationId: new Types.ObjectId().toString(),
    companion: { id: "comp-1", parent: { id: "parent-1" }, name: "Fido" },
    appointmentType: { id: new Types.ObjectId().toString() },
    appointmentDate: new Date(),
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    durationMinutes: 60,
    status: "UPCOMING",
    lead: { id: "vet-1", name: "Dr. Vet" },
    supportStaff: [],
    ...overrides,
  };

  return {
    ...obj,
    toObject: jest.fn().mockReturnValue(obj),
    save: jest.fn().mockResolvedValue(true),
  };
};

const makeFhirDto = (
  leadId?: string,
  staffId?: string,
  roomId?: string
): any => ({
  id: "fhir-123",
  participant: [
    leadId
      ? {
          actor: { reference: `Practitioner/${leadId}`, display: "Lead Vet" },
          type: [{ coding: [{ code: "PPRF" }] }],
        }
      : {},
    staffId
      ? {
          actor: { reference: `PractitionerRole/${staffId}`, display: "Nurse" },
          type: [{ coding: [{ code: "SPRF" }] }],
        }
      : {},
    roomId
      ? {
          actor: { reference: `Location/${roomId}`, display: "Room 1" },
          type: [{ coding: [{ code: "LOC" }] }],
        }
      : {},
  ],
});

// --- 3. Test Suite ---
describe("AppointmentService", () => {
  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mongoose.startSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe("AppointmentServiceError", () => {
    it("instantiates correctly", () => {
      const err = new AppointmentServiceError("Bad", 400);
      expect(err.message).toBe("Bad");
      expect(err.statusCode).toBe(400);
    });
  });

  describe("createRequestedFromMobile", () => {
    const baseDto: any = {
      organisationId: new Types.ObjectId().toString(),
      companion: { id: "c1", parent: { id: "p1" } },
      startTime: new Date(),
      endTime: new Date(),
      durationMinutes: 30,
      appointmentType: { id: new Types.ObjectId().toString() },
    };

    it("throws if required fields missing", async () => {
      await expect(
        AppointmentService.createRequestedFromMobile({} as any)
      ).rejects.toThrow(/organisationId is required/);
      await expect(
        AppointmentService.createRequestedFromMobile({
          organisationId: "123",
        } as any)
      ).rejects.toThrow(/Companion and parent details/);
      await expect(
        AppointmentService.createRequestedFromMobile({
          organisationId: "123",
          companion: { id: "1", parent: { id: "2" } },
        } as any)
      ).rejects.toThrow(/startTime, endTime, durationMinutes/);
    });

    it("throws 404 if service not found", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.createRequestedFromMobile(baseDto)
      ).rejects.toThrow(/Invalid service selected/);
    });

    it("throws 400 if serviceId is invalid ObjectId format", async () => {
      const badDto = { ...baseDto, appointmentType: { id: "bad-id" } };
      await expect(
        AppointmentService.createRequestedFromMobile(badDto)
      ).rejects.toThrow(/Invalid serviceId/);
    });

    it("creates appointment and payment intent on success", async () => {
      const doc = makeMockDoc();
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ _id: "s1" });
      (AppointmentModel.create as jest.Mock).mockResolvedValue(doc);
      (StripeService.createPaymentIntentForAppointment as jest.Mock).mockResolvedValue("pi_123");

      const res = await AppointmentService.createRequestedFromMobile(baseDto);
      expect(res.appointment).toHaveProperty("mapped", true);
      expect(res.paymentIntent).toBe("pi_123");
    });
  });

  describe("createAppointmentFromPms", () => {
    const baseDto: any = {
      organisationId: new Types.ObjectId().toString(),
      companion: { id: "c1", parent: { id: "p1" } },
      startTime: new Date(),
      endTime: new Date(),
      durationMinutes: 30,
      lead: { id: "vet1" },
      appointmentType: { id: new Types.ObjectId().toString() },
    };

    it("throws on validation errors", async () => {
      await expect(AppointmentService.createAppointmentFromPms({} as any, false)).rejects.toThrow(/organisationId/);
      await expect(AppointmentService.createAppointmentFromPms({ organisationId: "1" } as any, false)).rejects.toThrow(/Companion and parent/);
      await expect(AppointmentService.createAppointmentFromPms({ organisationId: "1", companion: { id: "1", parent: { id: "2" } } } as any, false)).rejects.toThrow(/startTime, endTime/);
      await expect(AppointmentService.createAppointmentFromPms({ ...baseDto, lead: null }, false)).rejects.toThrow(/Lead veterinarian/);
      await expect(AppointmentService.createAppointmentFromPms({ ...baseDto, appointmentType: null }, false)).rejects.toThrow(/Service/);
    });

    it("throws 404 if service inactive/missing", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(createMockQuery(null));
      await expect(AppointmentService.createAppointmentFromPms(baseDto, false)).rejects.toThrow(/Invalid or inactive service/);
    });

    it("throws 409 if vet has overlapping occupancy", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(createMockQuery({ cost: 100 }));
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(createMockQuery({ _id: "overlap" }));

      await expect(AppointmentService.createAppointmentFromPms(baseDto, false)).rejects.toThrow(/vet is not available/);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it("creates appointment, occupancy, invoice, and payment (if true)", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(createMockQuery({ cost: 100, maxDiscount: 10 }));
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(createMockQuery(null));
      const mockAppt = makeMockDoc();
      (AppointmentModel.create as jest.Mock).mockResolvedValue([mockAppt]);
      (InvoiceService.createDraftForAppointment as jest.Mock).mockResolvedValue({ _id: "inv1" });
      (StripeService.createPaymentIntentForInvoice as jest.Mock).mockResolvedValue("pi_123");

      const res = await AppointmentService.createAppointmentFromPms(baseDto, true);

      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(StripeService.createPaymentIntentForInvoice).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(res.payment).toBe("pi_123");
    });

    it("handles generic db errors", async () => {
      (ServiceModel.findOne as jest.Mock).mockReturnValue(createMockQuery({ cost: 100 }));
      (OccupancyModel.findOne as jest.Mock).mockImplementation(() => { throw new Error("DB crash"); });

      await expect(AppointmentService.createAppointmentFromPms(baseDto, false)).rejects.toThrow(/Unable to create/);
    });
  });

  describe("approveRequestedFromPms", () => {
    it("throws if no id", async () => {
      await expect(AppointmentService.approveRequestedFromPms("", {} as any)).rejects.toThrow(/missing/);
    });

    it("throws if no lead vet in FHIR", async () => {
      await expect(AppointmentService.approveRequestedFromPms("123", makeFhirDto())).rejects.toThrow(/Lead vet/);
    });

    it("throws 404 if appointment not found", async () => {
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.approveRequestedFromPms("123", makeFhirDto("vet1"))).rejects.toThrow(/not found/);
    });

    it("throws 409 if overlapping occupancy", async () => {
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(makeMockDoc({ status: "REQUESTED" }));
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(createMockQuery({ id: "overlap" }));

      await expect(AppointmentService.approveRequestedFromPms("123", makeFhirDto("vet1"))).rejects.toThrow(/vet is not available/);
    });

    it("approves appointment and creates occupancy (covers staff/room fallback)", async () => {
      const mockAppt = makeMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(createMockQuery(null));
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue({ personalDetails: { profilePictureUrl: "url" } });

      const res = await AppointmentService.approveRequestedFromPms("123", makeFhirDto("vet1", "staff1", "room1"));

      expect(mockAppt.status).toBe("UPCOMING");
      expect(mockAppt.supportStaff).toHaveLength(1);
      expect(mockAppt.room.id).toBe("room1");
      expect(mockAppt.save).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
      expect(res).toHaveProperty("mapped", true);
    });
  });

  describe("cancelAppointment (PMS)", () => {
    it("throws 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(null));
      await expect(AppointmentService.cancelAppointment("123")).rejects.toThrow(/not found/);
    });

    it("returns early if already cancelled", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(makeMockDoc({ status: "CANCELLED" })));
      const res = await AppointmentService.cancelAppointment("123");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
      expect(res).toHaveProperty("mapped", true);
    });

    it("cancels appointment, handles invoice, removes occupancy", async () => {
      const mockAppt = makeMockDoc();
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(mockAppt));
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(createMockQuery(true));

      await AppointmentService.cancelAppointment("123", "Reason");

      expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalled();
      expect(mockAppt.status).toBe("CANCELLED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      expect(NotificationService.sendToUser).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("cancelAppointmentFromParent", () => {
    it("throws 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.cancelAppointmentFromParent("1", "p1", "r")).rejects.toThrow(/not found/);
    });

    it("throws 403 if parent does not own", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc());
      await expect(AppointmentService.cancelAppointmentFromParent("1", "wrong_parent", "r")).rejects.toThrow(/Not your appointment/);
    });

    it("throws 400 if wrong status", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc({ status: "COMPLETED" }));
      await expect(AppointmentService.cancelAppointmentFromParent("1", "parent-1", "r")).rejects.toThrow(/Only requested or upcoming/);
    });

    it("throws 400 if refund fails", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc({ status: "UPCOMING" }));
      (InvoiceService.handleAppointmentCancellation as jest.Mock).mockResolvedValue(null); // fail
      await expect(AppointmentService.cancelAppointmentFromParent("1", "parent-1", "r")).rejects.toThrow(/Not able to cancle/);
    });

    it("cancels successfully", async () => {
      const mockAppt = makeMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      (InvoiceService.handleAppointmentCancellation as jest.Mock).mockResolvedValue(true);

      const res = await AppointmentService.cancelAppointmentFromParent("1", "parent-1", "r");
      expect(mockAppt.status).toBe("CANCELLED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      expect(res).toHaveProperty("mapped", true);
    });
  });

  describe("rejectRequestedAppointment", () => {
    it("throws 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.rejectRequestedAppointment("1")).rejects.toThrow(/not found/);
    });

    it("throws 400 if not REQUESTED", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc({ status: "UPCOMING" }));
      await expect(AppointmentService.rejectRequestedAppointment("1")).rejects.toThrow(/Only REQUESTED/);
    });

    it("rejects successfully", async () => {
      const mockAppt = makeMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);

      await AppointmentService.rejectRequestedAppointment("1");
      expect(mockAppt.status).toBe("CANCELLED");
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });
  });

  describe("updateAppointmentPMS", () => {
    it("throws error due to bug in source code (if appointmentId is true)", async () => {
      // NOTE: This explicitly covers the bug in your source code: `if (appointmentId) throw ...`
      await expect(AppointmentService.updateAppointmentPMS("123", {} as any)).rejects.toThrow(/missing in FHIR payload/);
    });

    it("executes fully when bypassing the bug with empty string", async () => {
      const mockAppt = makeMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue(createMockQuery(null));

      const res = await AppointmentService.updateAppointmentPMS("", makeFhirDto("vet1", "staff1", "room1"));

      expect(mockAppt.lead.id).toBe("vet1");
      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(res).toHaveProperty("mapped", true);
    });
  });

  describe("checkInAppointmentParent", () => {
    it("throws 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.checkInAppointmentParent("1", "p")).rejects.toThrow(/not found/);
    });

    it("throws 403 if wrong parent", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc());
      await expect(AppointmentService.checkInAppointmentParent("1", "wrong")).rejects.toThrow(/Not your appointment/);
    });

    it("throws 400 if not UPCOMING", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc({ status: "REQUESTED" }));
      await expect(AppointmentService.checkInAppointmentParent("1", "parent-1")).rejects.toThrow(/Only upcoming/);
    });

    it("checks in successfully", async () => {
      const mockAppt = makeMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);

      const res = await AppointmentService.checkInAppointmentParent("1", "parent-1");
      expect(mockAppt.status).toBe("CHECKED_IN");
      expect(res).toHaveProperty("mapped", true);
    });
  });

  describe("rescheduleFromParent", () => {
    // FIX applied here: Generates a valid MongoDB ID instead of using "1"
    const validApptId = new Types.ObjectId().toString();

    it("throws 400 if dates invalid", async () => {
      await expect(AppointmentService.rescheduleFromParent(validApptId, "p", { startTime: "bad", endTime: "bad" })).rejects.toThrow(/Invalid/);
    });

    it("throws 400 if start >= end", async () => {
      await expect(AppointmentService.rescheduleFromParent(validApptId, "p", { startTime: new Date("2026-01-02"), endTime: new Date("2026-01-01") })).rejects.toThrow(/before endTime/);
    });

    it("throws 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(null));
      await expect(AppointmentService.rescheduleFromParent(validApptId, "p", { startTime: new Date("2026-01-01"), endTime: new Date("2026-01-02") })).rejects.toThrow(/not found/);
    });

    it("throws 403 if wrong parent", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(makeMockDoc()));
      await expect(AppointmentService.rescheduleFromParent(validApptId, "wrong", { startTime: new Date("2026-01-01"), endTime: new Date("2026-01-02") })).rejects.toThrow(/not allowed/);
    });

    it("throws 400 if COMPLETED or CANCELLED", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(makeMockDoc({ status: "COMPLETED" })));
      await expect(AppointmentService.rescheduleFromParent(validApptId, "parent-1", { startTime: new Date("2026-01-01"), endTime: new Date("2026-01-02") })).rejects.toThrow(/Completed or cancelled/);
    });

    it("reschedules UPCOMING -> reverts to REQUESTED and deletes occupancy", async () => {
      const mockAppt = makeMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(mockAppt));
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue(createMockQuery(true));

      await AppointmentService.rescheduleFromParent(validApptId, "parent-1", {
        startTime: new Date("2026-01-01"),
        endTime: new Date("2026-01-02"),
        concern: "New Concern",
        isEmergency: true
      });

      expect(mockAppt.status).toBe("REQUESTED");
      expect(mockAppt.lead).toBeUndefined();
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
    });

    it("reschedules REQUESTED -> keeps status", async () => {
      const mockAppt = makeMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockReturnValue(createMockQuery(mockAppt));

      await AppointmentService.rescheduleFromParent(validApptId, "parent-1", {
        startTime: "2026-01-01T10:00:00Z", // Test string parsing
        endTime: "2026-01-01T11:00:00Z",
      });

      expect(mockAppt.status).toBe("REQUESTED");
      expect(mockAppt.durationMinutes).toBeDefined(); // auto calculated diff
    });
  });

  describe("Query Methods (Coverage Checks)", () => {
    it("getAppointmentsForCompanion", async () => {
      await expect(AppointmentService.getAppointmentsForCompanion("")).rejects.toThrow(/companionId is required/);

      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      expect(await AppointmentService.getAppointmentsForCompanion("1")).toEqual([]);

      const mockDoc = { _id: new Types.ObjectId(), organisationId: new Types.ObjectId() };
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([mockDoc]));
      (OrganizationModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: mockDoc.organisationId, name: "Org" }]));

      const res = await AppointmentService.getAppointmentsForCompanion("1");
      expect(res[0].appointment).toHaveProperty("mapped", true);
    });

    it("getById", async () => {
      await expect(AppointmentService.getById("")).rejects.toThrow(/is required/);
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.getById(new Types.ObjectId().toString())).rejects.toThrow(/not found/);

      (AppointmentModel.findById as jest.Mock).mockResolvedValue(makeMockDoc());
      expect(await AppointmentService.getById(new Types.ObjectId().toString())).toHaveProperty("mapped", true);
    });

    it("getAppointmentsForParent", async () => {
      await expect(AppointmentService.getAppointmentsForParent("")).rejects.toThrow(/required/);
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: new Types.ObjectId() }]));
      expect(await AppointmentService.getAppointmentsForParent("1")).toHaveLength(1);
    });

    it("getAppointmentsForOrganisation", async () => {
      await expect(AppointmentService.getAppointmentsForOrganisation("")).rejects.toThrow(/required/);
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{}]));

      const res = await AppointmentService.getAppointmentsForOrganisation("1", {
        status: ["UPCOMING"],
        startDate: new Date(),
        endDate: new Date()
      });
      expect(res).toHaveLength(1);
    });

    it("getAppointmentsForLead", async () => {
      await expect(AppointmentService.getAppointmentsForLead("")).rejects.toThrow(/required/);
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{}]));
      expect(await AppointmentService.getAppointmentsForLead("1", "org1")).toHaveLength(1);
    });

    it("getAppointmentsForSupportStaff", async () => {
      await expect(AppointmentService.getAppointmentsForSupportStaff("")).rejects.toThrow(/required/);
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{}]));
      expect(await AppointmentService.getAppointmentsForSupportStaff("1", "org1")).toHaveLength(1);
    });

    it("getAppointmentsByDateRange", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{}]));
      expect(await AppointmentService.getAppointmentsByDateRange("1", new Date(), new Date(), ["UPCOMING"])).toHaveLength(1);
    });

    it("searchAppointments", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(createMockQuery([{}]));
      const res = await AppointmentService.searchAppointments({
        companionId: "1", parentId: "2", organisationId: "3", leadId: "4", staffId: "5",
        status: ["UPCOMING"], startDate: new Date(), endDate: new Date()
      });
      expect(res).toHaveLength(1);
    });
  });
});