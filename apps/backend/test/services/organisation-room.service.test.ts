import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma";
import {
  OrganisationRoomService,
  OrganisationRoomServiceError,
} from "../../src/services/organisation-room.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organisationRoom: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    roomUnit: {
      findMany: jest.fn(),
    },
    roomUnitGroup: {
      findMany: jest.fn(),
    },
    admission: {
      findMany: jest.fn(),
    },
    organisationRoomSpeciality: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    organisationRoomStaff: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    speciality: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    userOrganization: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

const baseRoom = {
  id: "room_1",
  organisationId: "org_1",
  name: "Inpatient Ward A",
  code: "IP-01",
  description: "Main ward",
  type: "INPATIENT",
  occupancyStatus: "VACANT",
  assignedSpecialiteis: [{ id: "spec_1", name: "Cardiology" }],
  assignedStaffs: [
    { id: "staff_1", name: "Dr. One" },
    { id: "staff_2", name: "Dr. Two" },
  ],
  availableNow: true,
  availabilityMode: "ALL_DAY",
  availabilityDays: ["MONDAY", "TUESDAY"],
  availabilityStartTime: "08:00",
  availabilityEndTime: "18:00",
  capabilities: ["oxygen"],
  createdAt: new Date("2026-06-11T10:00:00.000Z"),
  updatedAt: new Date("2026-06-11T10:00:00.000Z"),
};

describe("OrganisationRoomService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(null);
    mockedPrisma.organisationRoom.findFirst.mockResolvedValue(null);
    mockedPrisma.organisationRoom.findMany.mockResolvedValue([]);
    mockedPrisma.organisationRoom.create.mockResolvedValue(baseRoom);
    mockedPrisma.organisationRoom.update.mockResolvedValue({
      ...baseRoom,
      availableNow: false,
    });
    mockedPrisma.organisationRoom.delete.mockResolvedValue(baseRoom);
    mockedPrisma.roomUnit.findMany.mockResolvedValue([]);
    mockedPrisma.roomUnitGroup.findMany.mockResolvedValue([]);
    mockedPrisma.admission.findMany.mockResolvedValue([]);
    mockedPrisma.organisationRoomSpeciality.findMany.mockResolvedValue([]);
    mockedPrisma.organisationRoomStaff.findMany.mockResolvedValue([]);
    mockedPrisma.organisationRoomSpeciality.createMany.mockResolvedValue({});
    mockedPrisma.organisationRoomStaff.createMany.mockResolvedValue({});
    mockedPrisma.organisationRoomSpeciality.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockedPrisma.organisationRoomStaff.deleteMany.mockResolvedValue({
      count: 0,
    });
    mockedPrisma.speciality.findMany.mockResolvedValue([
      {
        id: "spec_1",
        name: "Cardiology",
        organisationId: "org_1",
      },
    ]);
    mockedPrisma.user.findMany.mockResolvedValue([
      {
        userId: "staff_1",
        firstName: "Dr.",
        lastName: "One",
      },
      {
        userId: "staff_2",
        firstName: "Dr.",
        lastName: "Two",
      },
    ]);
    mockedPrisma.userOrganization.findMany.mockResolvedValue([
      { practitionerReference: "staff_1" },
      { practitionerReference: "staff_2" },
    ]);
  });

  it("creates a room with defaults and validates unique code", async () => {
    const result = await OrganisationRoomService.create({
      organisationId: "org_1",
      name: "Inpatient Ward A",
      code: "IP-01",
      type: "INPATIENT",
      assignedSpecialiteis: [{ id: "spec_1", name: "Cardiology" }],
      assignedStaffs: [
        { id: "staff_1", name: "Dr. One" },
        { id: "staff_2", name: "Dr. Two" },
      ],
      capabilities: ["oxygen"],
    });

    expect(mockedPrisma.organisationRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          code: "IP-01",
        },
      }),
    );
    expect(mockedPrisma.organisationRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org_1",
          name: "Inpatient Ward A",
          code: "IP-01",
          type: "INPATIENT",
          occupancyStatus: "VACANT",
        }),
      }),
    );
    expect(
      mockedPrisma.organisationRoomSpeciality.createMany,
    ).toHaveBeenCalled();
    expect(mockedPrisma.organisationRoomStaff.createMany).toHaveBeenCalled();
    expect(result.code).toBe("IP-01");
    expect(result.availableNow).toBe(true);
    expect(result.assignedSpecialiteis[0]?.name).toBe("Cardiology");
  });

  it("generates a unique room code from the room name when code is blank", async () => {
    mockedPrisma.organisationRoom.findFirst
      .mockResolvedValueOnce({ id: "room_existing" })
      .mockResolvedValueOnce(null);
    mockedPrisma.organisationRoom.create.mockResolvedValueOnce({
      ...baseRoom,
      code: "inpatient-ward-a-2",
    });

    const result = await OrganisationRoomService.create({
      organisationId: "org_1",
      name: "Inpatient Ward A",
      code: "   ",
      type: "INPATIENT",
    });

    expect(mockedPrisma.organisationRoom.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          code: "inpatient-ward-a",
        },
      }),
    );
    expect(mockedPrisma.organisationRoom.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          code: "inpatient-ward-a-2",
        },
      }),
    );
    expect(mockedPrisma.organisationRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "inpatient-ward-a-2",
        }),
      }),
    );
    expect(result.code).toBe("inpatient-ward-a-2");
  });

  it("falls back to room when the generated slug would be empty", async () => {
    mockedPrisma.organisationRoom.create.mockResolvedValueOnce({
      ...baseRoom,
      code: "room",
    });

    const result = await OrganisationRoomService.create({
      organisationId: "org_1",
      name: "!!!",
      code: "",
      type: "CONSULTATION",
    });

    expect(mockedPrisma.organisationRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "room",
        }),
      }),
    );
    expect(result.code).toBe("room");
  });

  it("rejects duplicate room codes within the same organisation", async () => {
    mockedPrisma.organisationRoom.findFirst.mockResolvedValueOnce({
      id: "room_existing",
    });

    await expect(
      OrganisationRoomService.create({
        organisationId: "org_1",
        name: "Second room",
        code: "IP-01",
        type: "ICU",
      }),
    ).rejects.toMatchObject({
      message: "Room code must be unique within the organisation.",
      statusCode: 409,
    } satisfies Partial<OrganisationRoomServiceError>);
  });

  it("rejects room codes with invalid characters", async () => {
    await expect(
      OrganisationRoomService.create({
        organisationId: "org_1",
        name: "Exam Room",
        code: "BAD$CODE",
        type: "EXAM_ROOM",
      }),
    ).rejects.toMatchObject({
      message: "Invalid character in code.",
      statusCode: 400,
    });
  });

  it("generates a room code during updates when the code is blank", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
      ...baseRoom,
      code: "room-a",
    });
    mockedPrisma.organisationRoom.update.mockResolvedValueOnce({
      ...baseRoom,
      code: "room-a",
    });

    const result = await OrganisationRoomService.update("room_1", {
      name: "Room A",
      code: "",
    });

    expect(mockedPrisma.organisationRoom.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org_1",
          code: "room-a",
          id: { not: "room_1" },
        },
      }),
    );
    expect(mockedPrisma.organisationRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "room-a",
        }),
      }),
    );
    expect(result.code).toBe("room-a");
  });

  it("lists rooms with computed occupancy summary", async () => {
    mockedPrisma.organisationRoom.findMany.mockResolvedValue([baseRoom]);
    mockedPrisma.roomUnit.findMany.mockResolvedValue([
      {
        id: "unit_1",
        roomId: "room_1",
        unitGroupId: "group_1",
        code: "BED-01",
        displayName: "Bed 1",
        size: "M",
        speciesConstraints: ["dog"],
        isActive: true,
      },
      {
        id: "unit_2",
        roomId: "room_1",
        unitGroupId: "group_1",
        code: "BED-02",
        displayName: "Bed 2",
        size: "M",
        speciesConstraints: ["dog"],
        isActive: true,
      },
    ]);
    mockedPrisma.roomUnitGroup.findMany.mockResolvedValue([
      {
        id: "group_1",
        roomId: "room_1",
        name: "Dog ward",
        size: "Medium",
        unitCount: 2,
        speciesConstraints: ["dog"],
        capabilities: ["oxygen"],
        isActive: true,
      },
    ]);
    mockedPrisma.admission.findMany.mockResolvedValue([{ unitId: "unit_1" }]);

    const result =
      await OrganisationRoomService.getSummaryByOrganizationId("org_1");

    expect(result).toHaveLength(1);
    expect(result[0]?.totalUnits).toBe(2);
    expect(result[0]?.occupiedUnits).toBe(1);
    expect(result[0]?.vacantUnits).toBe(1);
    expect(result[0]?.occupancyDisplay).toBe("Vacant (1)");
    expect(result[0]?.unitGroups[0]?.occupiedCount).toBe(1);
  });

  it("returns room-level occupancy when no units exist", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(baseRoom);
    mockedPrisma.organisationRoom.findMany.mockResolvedValue([baseRoom]);

    const result = await OrganisationRoomService.getById("room_1", "org_1");

    expect(result.occupancySource).toBe("ROOM");
    expect(result.occupancyDisplay).toBe("VACANT");
  });

  it("toggles room availability without changing occupancy", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(baseRoom);

    const result = await OrganisationRoomService.toggleAvailability(
      "room_1",
      "org_1",
    );

    expect(mockedPrisma.organisationRoom.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "room_1" },
        data: { availableNow: false },
      }),
    );
    expect(result.availableNow).toBe(false);
  });

  it("deletes a room only for the owning organisation", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(baseRoom);

    const result = await OrganisationRoomService.delete("room_1", "org_1");

    expect(mockedPrisma.organisationRoom.delete).toHaveBeenCalledWith({
      where: { id: "room_1" },
    });
    expect(result.id).toBe("room_1");
  });

  it("rejects deleting a room from another organisation", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue({
      ...baseRoom,
      organisationId: "org_other",
    });

    await expect(
      OrganisationRoomService.delete("room_1", "org_1"),
    ).rejects.toMatchObject({
      message:
        "Organisation room does not belong to the requested organisation.",
      statusCode: 403,
    });
  });
});
