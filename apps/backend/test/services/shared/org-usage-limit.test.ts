import { prisma } from "src/config/prisma";
import {
  markFreeLimitReachedAt,
  type OrgUsageCountersDoc,
} from "src/services/shared/org-usage-limit";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organizationUsageCounter: {
      updateMany: jest.fn(),
    },
  },
}));

const updateManyMock = prisma.organizationUsageCounter
  .updateMany as unknown as jest.Mock;

const byOrgId = (counters: OrgUsageCountersDoc) => ({
  orgId: counters.orgId,
});

const usageUnderLimits: OrgUsageCountersDoc = {
  id: "usage-1",
  orgId: "org-1",
  freeLimitReachedAt: null,
  usersActiveCount: 1,
  freeUsersLimit: 10,
  appointmentsUsed: 5,
  freeAppointmentsLimit: 120,
  toolsUsed: 2,
  freeToolsLimit: 200,
};

describe("markFreeLimitReachedAt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns false without updating when usage is null", async () => {
    await expect(markFreeLimitReachedAt(null, byOrgId)).resolves.toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("returns false when the limit was already stamped", async () => {
    await expect(
      markFreeLimitReachedAt(
        { ...usageUnderLimits, freeLimitReachedAt: new Date() },
        byOrgId,
      ),
    ).resolves.toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("returns false while every free limit still has headroom", async () => {
    await expect(
      markFreeLimitReachedAt(usageUnderLimits, byOrgId),
    ).resolves.toBe(false);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it.each([
    ["users", { usersActiveCount: 10 }],
    ["appointments", { appointmentsUsed: 120 }],
    ["tools", { toolsUsed: 200 }],
  ])(
    "stamps the counter once the %s limit is reached",
    async (_label, overrides) => {
      updateManyMock.mockResolvedValueOnce({ count: 1 });

      await expect(
        markFreeLimitReachedAt({ ...usageUnderLimits, ...overrides }, byOrgId),
      ).resolves.toBe(true);

      expect(updateManyMock).toHaveBeenCalledWith({
        where: { orgId: "org-1", freeLimitReachedAt: null },
        data: { freeLimitReachedAt: expect.any(Date) },
      });
    },
  );

  it("treats missing appointment counters as zero once users are under limit", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(
      markFreeLimitReachedAt(
        { orgId: "org-1", usersActiveCount: 0, freeUsersLimit: 10 },
        byOrgId,
      ),
    ).resolves.toBe(true);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { orgId: "org-1", freeLimitReachedAt: null },
      data: { freeLimitReachedAt: expect.any(Date) },
    });
  });

  it("treats missing tool counters as zero once users and appointments are under limit", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(
      markFreeLimitReachedAt(
        {
          orgId: "org-1",
          usersActiveCount: 0,
          freeUsersLimit: 10,
          appointmentsUsed: 0,
          freeAppointmentsLimit: 120,
        },
        byOrgId,
      ),
    ).resolves.toBe(true);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { orgId: "org-1", freeLimitReachedAt: null },
      data: { freeLimitReachedAt: expect.any(Date) },
    });
  });

  it("treats missing counters and limits as zero (limit immediately reached)", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(
      markFreeLimitReachedAt({ orgId: "org-1" }, byOrgId),
    ).resolves.toBe(true);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { orgId: "org-1", freeLimitReachedAt: null },
      data: { freeLimitReachedAt: expect.any(Date) },
    });
  });

  it("addresses the row through the caller's where clause", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });

    await expect(
      markFreeLimitReachedAt(
        { ...usageUnderLimits, usersActiveCount: 10 },
        (counters) => ({ id: counters.id }),
      ),
    ).resolves.toBe(true);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "usage-1", freeLimitReachedAt: null },
      data: { freeLimitReachedAt: expect.any(Date) },
    });
  });

  it("returns false when another writer already stamped the row", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });

    await expect(
      markFreeLimitReachedAt(
        { ...usageUnderLimits, usersActiveCount: 10 },
        byOrgId,
      ),
    ).resolves.toBe(false);

    expect(updateManyMock).toHaveBeenCalledTimes(1);
  });
});
