import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { prisma } from "../../src/config/prisma";
import { RoomUnitService } from "../../src/services/room-unit.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    organisationRoom: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    admission: {
      findMany: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as any;

describe("RoomUnitService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue({
      id: "room_1",
      organisationId: "org_1",
      type: "INPATIENT",
    });
    mockedPrisma.admission.findMany.mockResolvedValue([]);
  });

  it("creates a room unit in a supported room", async () => {
    mockedPrisma.roomUnit.create.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValue({
      id: "group_1",
      roomId: "room_1",
      organisationId: "org_1",
    });

    const result = await RoomUnitService.create({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
    });

    expect(mockedPrisma.roomUnit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: "room_1",
          unitGroupId: "group_1",
          code: "KEN-01",
        }),
      }),
    );
    expect(result.code).toBe("KEN-01");
  });

  it("creates a room unit without an optional unit group", async () => {
    mockedPrisma.roomUnit.create.mockResolvedValue({
      id: "unit-2",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-02",
      displayName: "Kennel 2",
      size: null,
      speciesConstraints: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitService.create({
      id: "unit-2",
      organisationId: "org_1",
      roomId: "room_1",
      code: "KEN-02",
      displayName: "Kennel 2",
      size: "   ",
      speciesConstraints: undefined,
    });

    expect(mockedPrisma.roomUnitGroup.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.roomUnit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitGroupId: null,
          size: null,
        }),
      }),
    );
    expect(result.unitGroupId).toBeUndefined();
  });

  it("rejects units for unsupported room types", async () => {
    mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
      id: "room_1",
      organisationId: "org_1",
      type: "EXAM_ROOM",
    });

    await expect(
      RoomUnitService.create({
        id: "unit_1",
        organisationId: "org_1",
        roomId: "room_1",
        code: "KEN-01",
        displayName: "Kennel 1",
      }),
    ).rejects.toMatchObject({
      message:
        "Units are only supported for ICU, Inpatient, Isolation and Boarding rooms.",
      statusCode: 409,
    });
  });

  it("lists room units", async () => {
    mockedPrisma.roomUnit.findMany.mockResolvedValue([
      {
        id: "unit_1",
        organisationId: "org_1",
        roomId: "room_1",
        unitGroupId: null,
        code: "KEN-01",
        displayName: "Kennel 1",
        size: "M",
        speciesConstraints: ["dog"],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockedPrisma.admission.findMany.mockResolvedValue([{ unitId: "unit_1" }]);

    const results = await RoomUnitService.list({ organisationId: "org_1" });

    expect(results).toHaveLength(1);
    expect(results[0]?.displayName).toBe("Kennel 1");
    expect(results[0]?.isOccupied).toBe(true);
  });

  it("lists room units with all filters", async () => {
    mockedPrisma.roomUnit.findMany.mockResolvedValue([]);

    await RoomUnitService.list({
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      isActive: false,
    });

    expect(mockedPrisma.roomUnit.findMany).toHaveBeenCalledWith({
      where: {
        organisationId: "org_1",
        roomId: "room_1",
        unitGroupId: "group_1",
        isActive: false,
      },
      orderBy: { displayName: "asc" },
    });
  });

  it("updates a room unit without changing its group membership", async () => {
    mockedPrisma.roomUnit.findFirst.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnit.update.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1 Updated",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitService.update("unit_1", "org_1", {
      displayName: "Kennel 1 Updated",
    });

    expect(mockedPrisma.roomUnit.findFirst).toHaveBeenCalledWith({
      where: { id: "unit_1", organisationId: "org_1" },
    });
    expect(mockedPrisma.roomUnitGroup.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.roomUnit.update).toHaveBeenCalledWith({
      where: { id: "unit_1" },
      data: {
        roomId: "room_1",
        unitGroupId: null,
        code: undefined,
        displayName: "Kennel 1 Updated",
        size: undefined,
        speciesConstraints: undefined,
        isActive: undefined,
      },
    });
    expect(result.displayName).toBe("Kennel 1 Updated");
  });

  it("allows deactivating a unit after its room's type no longer supports units", async () => {
    // The room's type has since changed away from a unit-capable type (e.g.
    // INPATIENT -> SURGERY) - the unit itself isn't moving rooms, so cleanup
    // must still be able to deactivate it instead of 409ing forever.
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue({
      id: "room_1",
      organisationId: "org_1",
      type: "SURGERY",
    });
    mockedPrisma.roomUnit.findFirst.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnit.update.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitService.update("unit_1", "org_1", {
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });

  it("still rejects moving a unit into a room that does not support units", async () => {
    mockedPrisma.roomUnit.findFirst.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
      id: "room_2",
      organisationId: "org_1",
      type: "EXAM_ROOM",
    });

    await expect(
      RoomUnitService.update("unit_1", "org_1", { roomId: "room_2" }),
    ).rejects.toMatchObject({
      message:
        "Units are only supported for ICU, Inpatient, Isolation and Boarding rooms.",
      statusCode: 409,
    });
  });

  it("deletes a room unit in the same organisation", async () => {
    mockedPrisma.roomUnit.findUnique.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnit.delete.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await RoomUnitService.delete("unit_1", "org_1");

    expect(mockedPrisma.roomUnit.delete).toHaveBeenCalledWith({
      where: { id: "unit_1" },
    });
    expect(result.id).toBe("unit_1");
  });

  it("rejects missing units and unit group mismatches", async () => {
    mockedPrisma.roomUnit.findFirst.mockResolvedValueOnce(null);

    await expect(
      RoomUnitService.update("unit_missing", "org_1", {
        displayName: "Updated",
      }),
    ).rejects.toMatchObject({
      message: "Room unit not found.",
      statusCode: 404,
    });

    mockedPrisma.roomUnit.findFirst.mockResolvedValueOnce({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: "group_1",
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnitGroup.findUnique.mockResolvedValueOnce({
      id: "group_1",
      roomId: "room_2",
      organisationId: "org_1",
    });

    await expect(
      RoomUnitService.update("unit_1", "org_1", { unitGroupId: "group_1" }),
    ).rejects.toMatchObject({
      message: "Room unit group room mismatch.",
      statusCode: 409,
    });
  });

  it("does not update a unit owned by another organisation", async () => {
    mockedPrisma.roomUnit.findFirst.mockResolvedValueOnce(null);

    await expect(
      RoomUnitService.update("unit_1", "org_2", { displayName: "Taken over" }),
    ).rejects.toMatchObject({
      message: "Room unit not found.",
      statusCode: 404,
    });

    expect(mockedPrisma.roomUnit.findFirst).toHaveBeenCalledWith({
      where: { id: "unit_1", organisationId: "org_2" },
    });
    expect(mockedPrisma.roomUnit.update).not.toHaveBeenCalled();
  });

  it("never reassigns the organisation of an updated unit", async () => {
    mockedPrisma.roomUnit.findFirst.mockResolvedValueOnce({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockedPrisma.roomUnit.update.mockResolvedValue({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await RoomUnitService.update("unit_1", "org_1", {
      organisationId: "org_2",
      displayName: "Kennel 1",
    });

    expect(mockedPrisma.roomUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "unit_1" },
        data: expect.not.objectContaining({
          organisationId: expect.anything(),
        }),
      }),
    );
  });

  it("requires an organisation to list units", async () => {
    await expect(
      RoomUnitService.list({ organisationId: "" }),
    ).rejects.toMatchObject({
      message: "organisationId is required.",
      statusCode: 400,
    });

    expect(mockedPrisma.roomUnit.findMany).not.toHaveBeenCalled();
  });

  it("rejects delete org mismatches", async () => {
    mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
      id: "unit_1",
      organisationId: "org_1",
      roomId: "room_1",
      unitGroupId: null,
      code: "KEN-01",
      displayName: "Kennel 1",
      size: "M",
      speciesConstraints: ["dog"],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      RoomUnitService.delete("unit_1", "org_2"),
    ).rejects.toMatchObject({
      message: "Unit organisation mismatch.",
      statusCode: 409,
    });
  });
});
