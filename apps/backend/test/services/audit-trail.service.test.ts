import {
  AuditTrailService,
  AuditTrailServiceError,
} from "../../src/services/audit-trail.service";
import AuditTrailModel from "../../src/models/audit-trail";
import { ParentModel } from "../../src/models/parent";
import UserModel from "../../src/models/user";
import logger from "../../src/utils/logger";

// --- Mocks ---
jest.mock("../../src/models/audit-trail");
jest.mock("../../src/models/parent");
jest.mock("../../src/models/user");
jest.mock("../../src/utils/logger");

// --- Helper: Mongoose Chain Mock ---
const mockChain = (result: any = null) => {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  } as any;
};

// --- Helper: Mock Document ---
const mockDoc = (data: any) => ({
  ...data,
  occurredAt: data.occurredAt instanceof Date ? data.occurredAt : new Date(),
  toObject: jest.fn(() => data),
});

describe("AuditTrailService", () => {
  const validRecordInput: any = {
    organisationId: "org-1",
    companionId: "comp-1",
    eventType: "APPOINTMENT_BOOKED",
    actorType: "PARENT",
    actorId: "parent-1",
    entityType: "APPOINTMENT",
    entityId: "appt-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mongoose Mocks
    (AuditTrailModel.create as jest.Mock).mockResolvedValue(mockDoc(validRecordInput));
    (AuditTrailModel.find as jest.Mock).mockReturnValue(mockChain([]));
    (ParentModel.findById as jest.Mock).mockReturnValue(mockChain(null));
    (UserModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
  });

  describe("Validation (ensureSafeString)", () => {
    it("should throw if required string is empty", async () => {
      await expect(
        AuditTrailService.record({ ...validRecordInput, organisationId: "" })
      ).rejects.toThrow("organisationId is required");

      await expect(
        AuditTrailService.record({ ...validRecordInput, organisationId: "   " })
      ).rejects.toThrow("organisationId is required");
    });

    it("should throw if string contains unsafe characters ($)", async () => {
      await expect(
        AuditTrailService.record({ ...validRecordInput, organisationId: "bad$id" })
      ).rejects.toThrow("Invalid organisationId");
    });

    it("should throw if string contains unsafe characters (.)", async () => {
        await expect(
          AuditTrailService.record({ ...validRecordInput, organisationId: "bad.id" })
        ).rejects.toThrow("Invalid organisationId");
      });
  });

  describe("record", () => {
    it("should create audit record with direct actor name", async () => {
      const input = { ...validRecordInput, actorName: "John Doe" };
      await AuditTrailService.record(input);

      expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
        actorName: "John Doe"
      }));
    });

    it("should resolve actor name for PARENT", async () => {
      (ParentModel.findById as jest.Mock).mockReturnValue(
        mockChain({ firstName: "Jane", lastName: "Doe" })
      );

      const input = { ...validRecordInput, actorName: null, actorType: "PARENT", actorId: "p1" };
      await AuditTrailService.record(input);

      expect(ParentModel.findById).toHaveBeenCalledWith("p1");
      expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
        actorName: "Jane Doe"
      }));
    });

    it("should resolve actor name for PMS_USER", async () => {
        (UserModel.findOne as jest.Mock).mockReturnValue(
          mockChain({ firstName: "Admin", lastName: "User" })
        );

        const input = { ...validRecordInput, actorName: undefined, actorType: "PMS_USER", actorId: "u1" };
        await AuditTrailService.record(input);

        expect(UserModel.findOne).toHaveBeenCalledWith({ userId: "u1" }, expect.anything());
        expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
          actorName: "Admin User"
        }));
      });

    it("should handle missing actor profile gracefully (null name)", async () => {
        (ParentModel.findById as jest.Mock).mockReturnValue(mockChain(null));

        const input = { ...validRecordInput, actorName: undefined, actorType: "PARENT", actorId: "p1" };
        await AuditTrailService.record(input);

        expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
            actorName: null
        }));
    });

    it("should skip resolution if actorType/Id missing", async () => {
        const input = { ...validRecordInput, actorType: undefined };
        await AuditTrailService.record(input);
        expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
            actorName: null
        }));
    });

    it("should use provided occurredAt or default to now", async () => {
        const date = new Date("2023-01-01");
        await AuditTrailService.record({ ...validRecordInput, occurredAt: date });
        expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({ occurredAt: date }));

        await AuditTrailService.record({ ...validRecordInput, occurredAt: undefined });
        expect(AuditTrailModel.create).toHaveBeenCalledWith(expect.objectContaining({
             occurredAt: expect.any(Date)
        }));
    });
  });

  describe("recordSafely", () => {
    it("should succeed silently", async () => {
      await AuditTrailService.recordSafely(validRecordInput);
      expect(AuditTrailModel.create).toHaveBeenCalled();
    });

    it("should catch and log error on failure", async () => {
      (AuditTrailModel.create as jest.Mock).mockRejectedValue(new Error("DB Error"));

      await AuditTrailService.recordSafely(validRecordInput);

      expect(logger.warn).toHaveBeenCalledWith("Audit trail record failed", expect.any(Error));
    });
  });

  describe("listForOrganisation", () => {
    it("should build correct filters and return results", async () => {
      const mockDate = new Date();
      (AuditTrailModel.find as jest.Mock).mockReturnValue(
        mockChain([mockDoc({ ...validRecordInput, occurredAt: mockDate })])
      );

      const res = await AuditTrailService.listForOrganisation({
        organisationId: "org-1",
        companionId: "comp-1",
        eventTypes: ["APPOINTMENT_BOOKED"] as any, // Cast to avoid TS enum issues
        entityTypes: ["APPOINTMENT"] as any,
        limit: 10,
        before: mockDate
      });

      expect(AuditTrailModel.find).toHaveBeenCalledWith({
        organisationId: "org-1",
        companionId: "comp-1",
        eventType: { $in: ["APPOINTMENT_BOOKED"] },
        entityType: { $in: ["APPOINTMENT"] },
        occurredAt: { $lt: mockDate }
      });
      expect(res.entries).toHaveLength(1);
      expect(res.nextCursor).toBe(mockDate.toISOString());
    });

    it("should handle empty results and null cursor", async () => {
        (AuditTrailModel.find as jest.Mock).mockReturnValue(mockChain([]));
        const res = await AuditTrailService.listForOrganisation({ organisationId: "org-1" });
        expect(res.nextCursor).toBeNull();
    });

    it("should clamp limit", async () => {
        await AuditTrailService.listForOrganisation({ organisationId: "org-1", limit: 500 });
        const findMock = (AuditTrailModel.find as jest.Mock).mock.results[0].value;
        expect(findMock.limit).toHaveBeenCalledWith(200); // Max 200

        await AuditTrailService.listForOrganisation({ organisationId: "org-1", limit: -5 });
        const findMock2 = (AuditTrailModel.find as jest.Mock).mock.results[1].value;
        expect(findMock2.limit).toHaveBeenCalledWith(1); // Min 1
    });
  });

  describe("listForAppointment", () => {
      it("should build correct appointment query filters", async () => {
        const date = new Date();
        await AuditTrailService.listForAppointment({
            organisationId: "org-1",
            appointmentId: "appt-1",
            before: date
        });

        expect(AuditTrailModel.find).toHaveBeenCalledWith({
            organisationId: "org-1",
            $or: [
                { entityType: "APPOINTMENT", entityId: "appt-1" },
                { "metadata.appointmentId": "appt-1" },
            ],
            occurredAt: { $lt: date }
        });
      });

      it("should return cursor based on last item", async () => {
          const date = new Date();
          (AuditTrailModel.find as jest.Mock).mockReturnValue(mockChain([
              mockDoc({ ...validRecordInput, occurredAt: date })
          ]));

          const res = await AuditTrailService.listForAppointment({ organisationId: "org-1", appointmentId: "a1" });
          expect(res.nextCursor).toBe(date.toISOString());
      });

      it("should handle null cursor for empty results", async () => {
        (AuditTrailModel.find as jest.Mock).mockReturnValue(mockChain([]));
        const res = await AuditTrailService.listForAppointment({ organisationId: "org-1", appointmentId: "a1" });
        expect(res.nextCursor).toBeNull();
      });
  });

  describe("Error Class", () => {
      it("should instantiate AuditTrailServiceError correctly", () => {
          const err = new AuditTrailServiceError("Test Error", 418);
          expect(err).toBeInstanceOf(Error);
          expect(err.name).toBe("AuditTrailServiceError");
          expect(err.statusCode).toBe(418);
          expect(err.message).toBe("Test Error");
      });
  });
});