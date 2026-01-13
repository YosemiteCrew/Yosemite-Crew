import mongoose, { Types } from "mongoose";
import { AppointmentService } from "../../src/services/appointment.service";
import AppointmentModel from "../../src/models/appointment";
import ServiceModel from "../../src/models/service";
import { InvoiceService } from "../../src/services/invoice.service";
import { OccupancyModel } from "../../src/models/occupancy";
import OrganizationModel from "../../src/models/organization";
import UserProfileModel from "../../src/models/user-profile";
import { NotificationService } from "../../src/services/notification.service";
import { fromAppointmentRequestDTO } from "@yosemite-crew/types";

// --- Mocks ---
jest.mock("../../src/models/appointment");
jest.mock("../../src/models/service");
jest.mock("../../src/services/invoice.service");
jest.mock("../../src/services/stripe.service");
jest.mock("../../src/models/occupancy");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/user-profile");
jest.mock("../../src/services/notification.service");
jest.mock("../../src/services/task.service");

// Mock the types package to control DTO parsing/mapping
jest.mock("@yosemite-crew/types", () => ({
  fromAppointmentRequestDTO: jest.fn(),
  toAppointmentResponseDTO: jest.fn((domain) => ({
    id: domain.id,
    status: domain.status,
    organisation: domain.organisation,
  })), // Simple pass-through
}));

describe("AppointmentService", () => {
  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  // Helper to handle mongoose chaining: .sort().lean(), .session(), etc.
  const mockMongooseChain = (data: any) => {
    return {
      session: jest.fn().mockResolvedValue(data),
      lean: jest.fn().mockResolvedValue(data),
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(data),
      }),
      exec: jest.fn().mockResolvedValue(data),
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(mongoose, "startSession").mockResolvedValue(mockSession as any);
  });

  const validObjectId = new Types.ObjectId().toString();
  const validOrgId = new Types.ObjectId().toString();
  const validParentId = new Types.ObjectId().toString();
  const validCompanionId = new Types.ObjectId().toString();

  // Defines what fromAppointmentRequestDTO returns
  const validParsedInput = {
    organisationId: validOrgId,
    companion: {
      id: validCompanionId,
      parent: { id: validParentId },
      name: "Buddy",
    },
    appointmentType: { id: validObjectId, name: "Consultation" },
    startTime: new Date("2023-10-25T10:00:00Z"),
    endTime: new Date("2023-10-25T10:30:00Z"),
    durationMinutes: 30,
    concern: "Checkup",
    isEmergency: false,
    lead: { id: validObjectId, name: "Dr. Smith" }, // Populated for PMS flows
    supportStaff: [],
    room: undefined,
    attachments: [],
  };

  const createMockDoc = (data: any) => ({
    _id: new Types.ObjectId(validObjectId),
    organisationId: new Types.ObjectId(validOrgId),
    status: "REQUESTED",
    startTime: validParsedInput.startTime,
    endTime: validParsedInput.endTime,
    companion: {
      id: validCompanionId,
      name: "Buddy",
      parent: {
        id: validParentId,
        name: "John Doe",
      },
    },
    ...data,
    toObject: function () {
      return { ...this, _id: this._id };
    },
    save: jest.fn().mockResolvedValue(true),
  });

  describe("createRequestedFromMobile", () => {
    const inputDto: any = { resourceType: "Appointment" }; // Dummy DTO, we control the parser

    it("should throw if organisationId is missing", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        organisationId: undefined,
      });

      await expect(
        AppointmentService.createRequestedFromMobile(inputDto),
      ).rejects.toThrow("organisationId is required");
    });

    it("should throw if companion/parent missing", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        companion: { id: undefined }, // Missing ID
      });

      await expect(
        AppointmentService.createRequestedFromMobile(inputDto),
      ).rejects.toThrow("Companion and parent details are required");
    });

    it("should throw if time details are missing", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        startTime: null,
      });

      await expect(
        AppointmentService.createRequestedFromMobile(inputDto),
      ).rejects.toThrow("startTime, endTime, durationMinutes required");
    });

    it("should throw if service not found", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue(
        validParsedInput,
      );
      (ServiceModel.findOne as jest.Mock).mockResolvedValue(null); // Service missing

      await expect(
        AppointmentService.createRequestedFromMobile(inputDto),
      ).rejects.toThrow("Invalid service selected");
    });
  });

  describe("createAppointmentFromPms", () => {
    const inputDto: any = { resourceType: "Appointment" };
    it("should throw if validation fails (missing lead)", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        lead: undefined,
      });

      await expect(
        AppointmentService.createAppointmentFromPms(inputDto, false),
      ).rejects.toThrow("Lead veterinarian (vet) is required");
    });

    it("should throw if service is invalid", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue(
        validParsedInput,
      );
      (ServiceModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        AppointmentService.createAppointmentFromPms(inputDto, false),
      ).rejects.toThrow("Invalid or inactive service");
    });
  });

  describe("approveRequestedFromPms", () => {
    // Unlike the previous two, this function uses `extractApprovalFieldsFromFHIR` internally which uses DTO directly.
    // However, that function is INTERNAL to the service file, so we rely on the `dto` passed.
    // We must construct `dto` carefully here since we cannot mock the internal function.
    const inputDto: any = {
      id: validObjectId,
      participant: [
        {
          type: [{ coding: [{ code: "PPRF" }] }],
          actor: {
            reference: `Practitioner/${validObjectId}`,
            display: "Dr. Lead",
          },
        },
        {
          type: [{ coding: [{ code: "SPRF" }] }],
          actor: { reference: `Practitioner/staff1`, display: "Nurse" },
        },
        {
          type: [{ coding: [{ code: "LOC" }] }],
          actor: { reference: `Location/room1`, display: "Room 1" },
        },
      ],
    };

    it("should approve appointment and create occupancy", async () => {
      const mockAppt = createMockDoc({
        _id: validObjectId,
        status: "REQUESTED",
      });
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      (OccupancyModel.create as jest.Mock).mockResolvedValue([]);
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue({
        personalDetails: { profilePictureUrl: "url" },
      });

      await AppointmentService.approveRequestedFromPms(validObjectId, inputDto);

      expect(mockAppt.status).toBe("UPCOMING");
      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it("should fail if appointment not found", async () => {
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.approveRequestedFromPms(validObjectId, inputDto),
      ).rejects.toThrow("Requested appointment not found");
    });

    it("should fail if lead vet is missing in DTO", async () => {
      const noVetDto = { ...inputDto, participant: [] };
      await expect(
        AppointmentService.approveRequestedFromPms(validObjectId, noVetDto),
      ).rejects.toThrow("Lead vet (Practitioner with code=PPRF) is required");
    });

    it("should fail if overlap exists", async () => {
      const mockAppt = createMockDoc({
        _id: validObjectId,
        status: "REQUESTED",
      });
      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: "occ" }),
      });

      await expect(
        AppointmentService.approveRequestedFromPms(validObjectId, inputDto),
      ).rejects.toThrow("Selected vet is not available");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe("cancelAppointment", () => {
    it("should cancel appointment and cleanup invoice/occupancy", async () => {
      const mockAppt = createMockDoc({
        status: "UPCOMING",
        lead: { id: "vet1" },
      });
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockAppt),
      });
      // Mock deleteMany with session support
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      });

      await AppointmentService.cancelAppointment(validObjectId, "Reason");

      expect(InvoiceService.handleAppointmentCancellation).toHaveBeenCalledWith(
        validObjectId,
        "Reason",
      );
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      expect(mockAppt.status).toBe("CANCELLED");
    });

    it("should return early if already cancelled", async () => {
      const mockAppt = createMockDoc({ status: "CANCELLED" });
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockAppt),
      });

      await AppointmentService.cancelAppointment(validObjectId);
      expect(
        InvoiceService.handleAppointmentCancellation,
      ).not.toHaveBeenCalled();
    });

    it("should throw 404 if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      await expect(
        AppointmentService.cancelAppointment(validObjectId),
      ).rejects.toThrow("Appointment not found");
    });

    it("should handle error propagation", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockRejectedValue(new Error("Fail")),
      });
      await expect(
        AppointmentService.cancelAppointment(validObjectId),
      ).rejects.toThrow("Fail");
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe("cancelAppointmentFromParent", () => {
    it("should cancel if parent owns appointment", async () => {
      const mockAppt = createMockDoc({
        status: "UPCOMING",
        lead: { id: "vet1" },
        companion: {
          id: validCompanionId,
          name: "Buddy",
          parent: { id: validParentId },
        },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(true);
      (OccupancyModel.deleteMany as jest.Mock).mockResolvedValue({
        deletedCount: 1,
      });

      await AppointmentService.cancelAppointmentFromParent(
        validObjectId,
        validParentId,
        "Changed mind",
      );

      expect(mockAppt.status).toBe("CANCELLED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
    });

    it("should throw if not owner", async () => {
      const mockAppt = createMockDoc({
        companion: { parent: { id: "otherParent" } },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await expect(
        AppointmentService.cancelAppointmentFromParent(
          validObjectId,
          validParentId,
          "",
        ),
      ).rejects.toThrow("Not your appointment");
    });

    it("should throw if status is invalid (e.g. COMPLETED)", async () => {
      const mockAppt = createMockDoc({
        status: "COMPLETED",
        companion: { parent: { id: validParentId } },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await expect(
        AppointmentService.cancelAppointmentFromParent(
          validObjectId,
          validParentId,
          "",
        ),
      ).rejects.toThrow(
        "Only requested or upcoming appointments can be cancelled",
      );
    });

    it("should throw if invoice cancellation fails", async () => {
      const mockAppt = createMockDoc({
        status: "UPCOMING",
        companion: { parent: { id: validParentId } },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      (
        InvoiceService.handleAppointmentCancellation as jest.Mock
      ).mockResolvedValue(false);

      await expect(
        AppointmentService.cancelAppointmentFromParent(
          validObjectId,
          validParentId,
          "",
        ),
      ).rejects.toThrow("Not able to cancle appointment");
    });
  });

  describe("rejectRequestedAppointment", () => {
    it("should reject requested appointment", async () => {
      const mockAppt = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);

      await AppointmentService.rejectRequestedAppointment(validObjectId);

      expect(mockAppt.status).toBe("CANCELLED");
      expect(NotificationService.sendToUser).toHaveBeenCalled();
    });

    it("should throw if not REQUESTED", async () => {
      const mockAppt = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await expect(
        AppointmentService.rejectRequestedAppointment(validObjectId),
      ).rejects.toThrow("Only REQUESTED appointments can be rejected");
    });

    it("should throw 404 if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        AppointmentService.rejectRequestedAppointment(validObjectId),
      ).rejects.toThrow("Appointment not found");
    });
  });

  describe("updateAppointmentPMS", () => {
    // Logic uses fromAppointmentRequestDTO, so we mock the return
    const inputDto: any = { resourceType: "Appointment" };

    it("should update appointment and occupancy if vet changes", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        lead: { id: "newVet", name: "Dr. New" }, // Vet changed
        startTime: validParsedInput.startTime,
        endTime: validParsedInput.endTime,
      });

      const mockAppt = createMockDoc({
        status: "UPCOMING",
        startTime: validParsedInput.startTime,
        endTime: validParsedInput.endTime,
        lead: { id: "oldVet" },
      });

      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });
      (OccupancyModel.create as jest.Mock).mockReturnValue([]);

      await AppointmentService.updateAppointmentPMS(validObjectId, inputDto);

      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
      expect(OccupancyModel.create).toHaveBeenCalled();
      expect(mockAppt.lead.id).toBe("newVet");
    });

    it("should throw if overlap on new vet", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        lead: { id: "newVet" },
      });

      const mockAppt = createMockDoc({
        status: "UPCOMING",
        lead: { id: "oldVet" },
      });

      (AppointmentModel.findOne as jest.Mock).mockResolvedValue(mockAppt);
      (OccupancyModel.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({ _id: "occ" }),
      });
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      await expect(
        AppointmentService.updateAppointmentPMS(validObjectId, inputDto),
      ).rejects.toThrow("Selected vet is not available");
    });

    it("should fail if no lead provided in DTO", async () => {
      (fromAppointmentRequestDTO as jest.Mock).mockReturnValue({
        ...validParsedInput,
        lead: undefined,
      });

      await expect(
        AppointmentService.updateAppointmentPMS(validObjectId, inputDto),
      ).rejects.toThrow("Lead vet (Practitioner with code=PPRF) is required");
    });
  });

  describe("checkIn Methods", () => {
    it("checkInAppointment: should check in UPCOMING appointment", async () => {
      const mockAppt = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);

      await AppointmentService.checkInAppointment(validObjectId);
      expect(mockAppt.status).toBe("CHECKED_IN");
    });

    it("checkInAppointment: should fail if not UPCOMING", async () => {
      const mockAppt = createMockDoc({ status: "REQUESTED" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await expect(
        AppointmentService.checkInAppointment(validObjectId),
      ).rejects.toThrow("Only upcoming appointments can be checked in");
    });

    it("checkInAppointmentParent: should check in if owner", async () => {
      const mockAppt = createMockDoc({ status: "UPCOMING" });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await AppointmentService.checkInAppointmentParent(
        validObjectId,
        validParentId,
      );
      expect(mockAppt.status).toBe("CHECKED_IN");
    });

    it("checkInAppointmentParent: should fail if not owner", async () => {
      const mockAppt = createMockDoc({
        status: "UPCOMING",
        companion: { parent: { id: "p2" } },
      });
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(mockAppt);
      await expect(
        AppointmentService.checkInAppointmentParent(
          validObjectId,
          validParentId,
        ),
      ).rejects.toThrow("Not your appointment");
    });
  });

  describe("rescheduleFromParent", () => {
    it("should reschedule and revert status if UPCOMING", async () => {
      const mockAppt = createMockDoc({
        status: "UPCOMING",
        companion: { parent: { id: validParentId } },
        startTime: new Date(),
      });
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockAppt),
      });
      (OccupancyModel.deleteMany as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      const newStart = new Date();
      const newEnd = new Date(newStart.getTime() + 60000);

      await AppointmentService.rescheduleFromParent(
        validObjectId,
        validParentId,
        { startTime: newStart, endTime: newEnd },
      );

      expect(mockAppt.status).toBe("REQUESTED");
      expect(OccupancyModel.deleteMany).toHaveBeenCalled();
    });

    it("should throw validation error if start >= end", async () => {
      const d = new Date();
      await expect(
        AppointmentService.rescheduleFromParent(validObjectId, validParentId, {
          startTime: d,
          endTime: d,
        }),
      ).rejects.toThrow("startTime must be before endTime");
    });

    it("should throw if appointment not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(null),
      });
      await expect(
        AppointmentService.rescheduleFromParent(validObjectId, validParentId, {
          startTime: new Date(),
          endTime: new Date(Date.now() + 1000),
        }),
      ).rejects.toThrow("Appointment not found");
    });

    it("should throw if status is COMPLETED", async () => {
      const mockAppt = createMockDoc({
        status: "COMPLETED",
        companion: { parent: { id: validParentId } },
      });
      (AppointmentModel.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockAppt),
      });
      await expect(
        AppointmentService.rescheduleFromParent(validObjectId, validParentId, {
          startTime: new Date(),
          endTime: new Date(Date.now() + 1000),
        }),
      ).rejects.toThrow(
        "Completed or cancelled appointments cannot be rescheduled",
      );
    });
  });

  describe("Getters and Search", () => {
    it("getAppointmentsForCompanion: should attach organization details", async () => {
      const apptData = createMockDoc({ organisationId: validOrgId });
      // Ensure structure matches toDomainLean
      const leanAppt = { ...apptData, _id: new Types.ObjectId(validObjectId) };
      delete leanAppt.toObject;
      delete leanAppt.save;

      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([leanAppt]),
      );
      (OrganizationModel.find as jest.Mock).mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { _id: new Types.ObjectId(validOrgId), name: "Clinic" },
          ]),
      });

      const res = await AppointmentService.getAppointmentsForCompanion("comp1");
      // Update: Optional chaining in case DTO mapping changes
      expect(res[0].organisation?.name).toBe("Clinic");
    });

    it("getAppointmentsForCompanion: should return empty if no docs", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      const res = await AppointmentService.getAppointmentsForCompanion("comp1");
      expect(res).toEqual([]);
    });

    it("getById: should return domain object", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(
        createMockDoc({}),
      );
      const res = await AppointmentService.getById(validObjectId);
      expect(res.id).toBe(validObjectId);
    });

    it("getById: should throw if not found", async () => {
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(AppointmentService.getById(validObjectId)).rejects.toThrow(
        "Appointment not found",
      );
    });

    it("getById: should throw if id invalid", async () => {
      await expect(AppointmentService.getById("invalid-id")).rejects.toThrow(
        "Invalid AppointmentId",
      );
    });

    it("getAppointmentsForOrganisation: should filter by date", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.getAppointmentsForOrganisation(validOrgId, {
        startDate: new Date(),
        endDate: new Date(),
      });
      expect(AppointmentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: expect.anything() }),
      );
    });

    it("getAppointmentsByDateRange: should query range", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.getAppointmentsByDateRange(
        validOrgId,
        new Date(),
        new Date(),
        ["UPCOMING"],
      );
      expect(AppointmentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ status: { $in: ["UPCOMING"] } }),
      );
    });

    it("searchAppointments: should build complex query", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.searchAppointments({
        companionId: "c1",
        leadId: "l1",
        startDate: new Date(),
        endDate: new Date(),
        status: ["UPCOMING"],
      });

      expect(AppointmentModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          "companion.id": "c1",
          "lead.id": "l1",
          status: { $in: ["UPCOMING"] },
        }),
      );
    });

    it("getAppointmentsForParent: should return list", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.getAppointmentsForParent("p1");
      expect(AppointmentModel.find).toHaveBeenCalled();
    });

    it("getAppointmentsForLead: should return list", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.getAppointmentsForLead("l1", validOrgId);
      expect(AppointmentModel.find).toHaveBeenCalled();
    });

    it("getAppointmentsForSupportStaff: should return list", async () => {
      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([]),
      );
      await AppointmentService.getAppointmentsForSupportStaff("s1", validOrgId);
      expect(AppointmentModel.find).toHaveBeenCalled();
    });
  });

  describe("Edge Case: Internal Helpers", () => {
    it("getAppointmentsForCompanion should handle lean objects in toDomainLean", async () => {
      const leanAppt = createMockDoc({ _id: validObjectId });
      const { toObject, save, ...leanData } = leanAppt;

      (AppointmentModel.find as jest.Mock).mockReturnValue(
        mockMongooseChain([leanData]),
      );
      (OrganizationModel.find as jest.Mock).mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = await AppointmentService.getAppointmentsForCompanion("comp1");
      expect(res[0].appointment.id).toBe(leanData._id.toString());
    });

    it("getById should accept Types.ObjectId directly", async () => {
      const objId = new Types.ObjectId(validObjectId);
      (AppointmentModel.findById as jest.Mock).mockResolvedValue(
        createMockDoc({ _id: objId }),
      );
      const res = await AppointmentService.getById(objId as any);
      expect(res.id).toBe(objId.toString());
    });
  });
});
