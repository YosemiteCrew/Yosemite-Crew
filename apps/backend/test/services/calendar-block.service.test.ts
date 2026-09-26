import {
  CalendarBlockService,
  CalendarBlockError,
} from "../../src/services/calendar-block.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    calendarBlock: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organisationRoom: { findFirst: jest.fn() },
    userOrganization: { findFirst: jest.fn() },
  },
}));

import { prisma } from "src/config/prisma";

const mockCalendar = prisma.calendarBlock as unknown as {
  create: jest.Mock;
  delete: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  update: jest.Mock;
};
const mockStaff = prisma.userOrganization.findFirst as jest.Mock;
const mockRoom = prisma.organisationRoom.findFirst as jest.Mock;
const startAt = new Date("2027-01-06T11:00:00.000Z");
const endAt = new Date("2027-01-06T12:00:00.000Z");
const row = {
  id: "block-1",
  organisationId: "org-1",
  targetType: "STAFF" as const,
  targetId: "Practitioner/staff-1",
  startAt,
  endAt,
  reason: "Lunch",
  createdBy: "user-1",
  createdAt: startAt,
  updatedAt: startAt,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStaff.mockResolvedValue({ id: "member-1" });
  mockRoom.mockResolvedValue({ id: "room-1" });
});

describe("CalendarBlockService", () => {
  it("lists overlapping blocks within an organization and rejects an invalid range", async () => {
    mockCalendar.findMany.mockResolvedValue([row]);
    await expect(
      CalendarBlockService.list(
        "org-1",
        startAt,
        new Date("2027-01-07T00:00:00Z"),
      ),
    ).resolves.toEqual([row]);
    expect(mockCalendar.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: "org-1",
          startAt: { lt: new Date("2027-01-07T00:00:00Z") },
          endAt: { gt: startAt },
        }),
      }),
    );
    await expect(
      CalendarBlockService.list("org-1", endAt, startAt),
    ).rejects.toBeInstanceOf(CalendarBlockError);
  });

  it("creates a validated staff or room block and trims its reason", async () => {
    mockCalendar.create.mockResolvedValue(row);
    await CalendarBlockService.create({
      organisationId: "org-1",
      targetType: "STAFF",
      targetId: "Practitioner/staff-1",
      startAt,
      endAt,
      reason: " Lunch ",
      createdBy: "user-1",
    });
    expect(mockStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationReference: expect.any(Object),
        }),
      }),
    );
    expect(mockCalendar.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: "Lunch" }),
      }),
    );

    await CalendarBlockService.create({
      organisationId: "org-1",
      targetType: "ROOM",
      targetId: "room-1",
      startAt,
      endAt,
      reason: "Training",
    });
    expect(mockRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: "org-1", id: "room-1", isActive: true },
      }),
    );
    await expect(
      CalendarBlockService.create({
        organisationId: "org-1",
        targetType: "STAFF",
        targetId: "staff-1",
        startAt: endAt,
        endAt: startAt,
        reason: "Invalid",
      }),
    ).rejects.toThrow("The end must be after the start.");
    mockStaff.mockResolvedValueOnce(null);
    await expect(
      CalendarBlockService.create({
        organisationId: "org-1",
        targetType: "STAFF",
        targetId: "missing",
        startAt,
        endAt,
        reason: "Lunch",
      }),
    ).rejects.toThrow("Calendar resource not found.");
    mockRoom.mockResolvedValueOnce(null);
    await expect(
      CalendarBlockService.create({
        organisationId: "org-1",
        targetType: "ROOM",
        targetId: "missing",
        startAt,
        endAt,
        reason: "Closure",
      }),
    ).rejects.toThrow("Calendar resource not found.");
  });

  it("updates an organization-owned block and validates replacement target and range", async () => {
    mockCalendar.findFirst.mockResolvedValue(row);
    mockCalendar.update.mockResolvedValue(row);
    await CalendarBlockService.update("org-1", "block-1", {
      reason: "Training",
    });
    expect(mockCalendar.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reason: "Training" } }),
    );
    await CalendarBlockService.update("org-1", "block-1", {
      targetType: "ROOM",
      targetId: "room-1",
      startAt,
      endAt,
    });
    expect(mockRoom).toHaveBeenCalled();
    await expect(
      CalendarBlockService.update("org-1", "block-1", { endAt: startAt }),
    ).rejects.toThrow("The end must be after the start.");
    mockCalendar.findFirst.mockResolvedValueOnce(null);
    await expect(
      CalendarBlockService.update("org-1", "missing", { reason: "X" }),
    ).rejects.toThrow("Calendar block not found.");
    mockRoom.mockResolvedValueOnce(null);
    await expect(
      CalendarBlockService.update("org-1", "block-1", {
        targetType: "ROOM",
        targetId: "missing",
      }),
    ).rejects.toThrow("Calendar resource not found.");
  });

  it("deletes only blocks owned by the requested organization", async () => {
    mockCalendar.findFirst.mockResolvedValue({ id: row.id });
    mockCalendar.delete.mockResolvedValue({});
    await CalendarBlockService.delete("org-1", "block-1");
    expect(mockCalendar.delete).toHaveBeenCalledWith({
      where: { id: "block-1" },
    });
    mockCalendar.findFirst.mockResolvedValueOnce(null);
    await expect(
      CalendarBlockService.delete("org-1", "other-org-block"),
    ).rejects.toThrow("Calendar block not found.");
  });
});
