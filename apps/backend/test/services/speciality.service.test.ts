import { SpecialityService } from "../../src/services/speciality.service";
import { ServiceService } from "../../src/services/service.service";
import * as EmailUtils from "../../src/utils/email";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("../../src/services/service.service");
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

jest.mock("src/config/prisma", () => ({
  prisma: {
    speciality: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    organisationRoomSpeciality: {
      deleteMany: jest.fn(),
    },
    organization: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock Types helper
jest.mock("@yosemite-crew/types", () => ({
  fromSpecialityRequestDTO: jest.fn((dto) => ({
    ...dto,
    services: dto.services,
  })),
  toSpecialityResponseDTO: jest.fn((domain) => domain),
}));

const hexId = () =>
  Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

const createPrismaSpeciality = (overrides: any = {}) => ({
  id: hexId(),
  fhirId: null,
  organisationId: hexId(),
  departmentMasterId: null,
  name: "Cardiology",
  description: null,
  headUserId: null,
  headName: null,
  headProfilePicUrl: null,
  services: [],
  memberUserIds: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("SpecialityService", () => {
  let mockOrgId: string;
  let mockSpecId: string;
  let validPayload: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgId = hexId();
    mockSpecId = hexId();

    validPayload = {
      resourceType: "Organization",
      id: mockSpecId,
      organisationId: mockOrgId,
      name: "Cardiology",
      headUserId: "user-123",
      active: true,
    };

    // Default Prisma mocks
    (prisma.speciality.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.speciality.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.speciality.create as jest.Mock).mockResolvedValue(
      createPrismaSpeciality({ id: mockSpecId, headUserId: null }),
    );
    (prisma.speciality.update as jest.Mock).mockResolvedValue(
      createPrismaSpeciality({ id: mockSpecId, headUserId: null }),
    );
    (prisma.speciality.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (
      prisma.organisationRoomSpeciality.deleteMany as jest.Mock
    ).mockResolvedValue({ count: 0 });
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
      name: "Test Org",
    });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      email: "doc@test.com",
      firstName: "Dr.",
      lastName: "Who",
    });
  });

  describe("Validation & Internals", () => {
    it("should throw error for invalid FHIR resource type", async () => {
      await expect(
        SpecialityService.createOne({ resourceType: "Patient" } as any),
      ).rejects.toThrow("Invalid payload. Expected FHIR Organization resource");
    });

    it("should throw error if Organization ID has invalid characters", async () => {
      const invalid = { ...validPayload, organisationId: "invalid$id" };
      await expect(SpecialityService.createOne(invalid)).rejects.toThrow(
        "Invalid character in Organisation identifier",
      );
    });

    it("should throw error if Name is missing", async () => {
      const invalid = { ...validPayload, name: null };
      await expect(SpecialityService.createOne(invalid)).rejects.toThrow(
        "Speciality name is required",
      );
    });

    it("should handle nested pruning of arrays and objects", async () => {
      const complexPayload = {
        ...validPayload,
        services: [undefined, "Service A", null],
        metadata: { key: undefined, val: "B" },
      };

      await SpecialityService.createOne(complexPayload);

      const persisted = (prisma.speciality.create as jest.Mock).mock
        .calls[0][0];
      expect(persisted.data.services).toEqual(["Service A"]);
    });
  });

  describe("createOne", () => {
    it("should create new speciality and return response", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId }),
      );

      const res = await SpecialityService.createOne(validPayload);

      expect(prisma.speciality.create).toHaveBeenCalled();
      expect(res.created).toBe(true);
      expect((res.response as any)._id).toBeDefined();
    });

    it("should upsert existing speciality (Update by ID)", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
        headUserId: "old-head",
      });
      (prisma.speciality.update as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "new-head" }),
      );

      const res = await SpecialityService.createOne(validPayload);

      expect(prisma.speciality.update).toHaveBeenCalled();
      expect(res.created).toBe(false);
    });

    it("should trigger email if head user changes during creation", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "user-123" }),
      );

      await SpecialityService.createOne(validPayload);

      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "specialityHeadAssigned" }),
      );
    });

    it("should NOT trigger email if head user is same", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
        headUserId: "user-123",
      });
      (prisma.speciality.update as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "user-123" }),
      );

      await SpecialityService.createOne(validPayload);

      await new Promise((resolve) => setImmediate(resolve));
      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("sends email using prisma user/org data", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "user-123" }),
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        name: "Test Org",
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: "doc@test.com",
        firstName: "Dr.",
        lastName: "Who",
      });

      await SpecialityService.createOne(validPayload);
      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "specialityHeadAssigned" }),
      );
    });
  });

  describe("createMany", () => {
    it("should create multiple specialities", async () => {
      const payloads = [validPayload, { ...validPayload, id: hexId() }];
      const res = await SpecialityService.createMany(payloads);
      expect(res).toHaveLength(2);
    });

    it("should throw error for empty list", async () => {
      await expect(SpecialityService.createMany([])).rejects.toThrow(
        "Payload list cannot be empty",
      );
    });
  });

  describe("update", () => {
    it("should update existing speciality", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
        headUserId: "old",
      });
      (prisma.speciality.update as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId }),
      );

      const res = await SpecialityService.update(mockSpecId, validPayload);
      expect(res).toBeDefined();
    });

    it("should persist team members from the payload during update", async () => {
      const payloadWithMembers = {
        ...validPayload,
        teamMemberIds: ["member-1", "member-2", "member-1"],
      };

      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
        headUserId: "old",
      });
      (prisma.speciality.update as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({
          id: mockSpecId,
          memberUserIds: ["member-1", "member-2"],
        }),
      );

      await SpecialityService.update(mockSpecId, payloadWithMembers as any);

      expect(prisma.speciality.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberUserIds: ["member-1", "member-2"],
          }),
        }),
      );
    });

    it("should return null if not found", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const res = await SpecialityService.update(mockSpecId, validPayload);
      expect(res).toBeNull();
    });

    it("should trigger email on head change", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
        headUserId: "old",
      });
      (prisma.speciality.update as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "new" }),
      );

      await SpecialityService.update(mockSpecId, validPayload);
      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should resolve by ID", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId }),
      );
      const res = await SpecialityService.getById(mockSpecId);
      expect(res).not.toBeNull();
    });

    it("should include the head user in team members when head is the only member", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({
          id: mockSpecId,
          headUserId: "head-only",
          memberUserIds: [],
        }),
      );

      const res = (await SpecialityService.getById(mockSpecId)) as any;

      expect(res).not.toBeNull();
      expect(res.teamMemberIds).toEqual(["head-only"]);
    });

    it("should not duplicate the head user in team members", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({
          id: mockSpecId,
          headUserId: "head-user",
          memberUserIds: ["head-user", "member-2"],
        }),
      );

      const res = (await SpecialityService.getById(mockSpecId)) as any;

      expect(res).not.toBeNull();
      expect(res.teamMemberIds).toEqual(["head-user", "member-2"]);
    });

    it("should resolve by FHIR ID (string)", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, fhirId: "fhir-123" }),
      );
      const res = await SpecialityService.getById("fhir-123");
      expect(res).not.toBeNull();
    });

    it("should return null if not found", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const res = await SpecialityService.getById(mockSpecId);
      expect(res).toBeNull();
    });

    it("should throw if ID format is invalid", async () => {
      await expect(SpecialityService.getById("bad$id")).rejects.toThrow(
        "Invalid character in Speciality identifier",
      );
    });
  });

  describe("getAllByOrganizationId", () => {
    it("should aggregate specialities and services", async () => {
      (prisma.speciality.findMany as jest.Mock).mockResolvedValueOnce([
        createPrismaSpeciality({ id: mockSpecId }),
      ]);
      (ServiceService.listBySpeciality as jest.Mock).mockResolvedValueOnce([
        "Service A",
      ]);

      const res = await SpecialityService.getAllByOrganizationId(mockOrgId);

      expect(res).toHaveLength(1);
      expect(res[0].services).toEqual(["Service A"]);
    });
  });

  describe("Delete Operations", () => {
    it("deleteAllByOrganizationId should call deleteMany", async () => {
      await SpecialityService.deleteAllByOrganizationId(mockOrgId);
      expect(prisma.speciality.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organisationId: mockOrgId }),
        }),
      );
    });

    it("deleteSpeciality should perform cascading delete", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce({
        id: mockSpecId,
      });

      await SpecialityService.deleteSpeciality(mockSpecId, mockOrgId);

      expect(ServiceService.deleteAllBySpecialityId).toHaveBeenCalledWith(
        mockSpecId,
      );
      expect(prisma.speciality.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: mockSpecId }),
        }),
      );
      expect(prisma.organisationRoomSpeciality.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: mockOrgId,
            specialityId: mockSpecId,
          }),
        }),
      );
    });

    it("deleteSpeciality should throw if not found", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        SpecialityService.deleteSpeciality(mockSpecId, mockOrgId),
      ).rejects.toThrow("Speciality not found for the organisation");
    });
  });

  describe("Email & Logger Edge Cases", () => {
    it("should log error if email sending fails", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "u1" }),
      );
      (prisma.user.findFirst as jest.Mock).mockRejectedValueOnce(
        new Error("Email Fail"),
      );

      await SpecialityService.createOne(validPayload);
      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalled();
    });

    it("should not send email if user has no email address", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "u1" }),
      );
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: null,
      });

      await SpecialityService.createOne(validPayload);
      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should handle missing organisation name gracefully in email", async () => {
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.speciality.create as jest.Mock).mockResolvedValueOnce(
        createPrismaSpeciality({ id: mockSpecId, headUserId: "u1" }),
      );
      (prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        email: "test@test.com",
      });

      await SpecialityService.createOne(validPayload);
      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalled();
    });
  });
});
