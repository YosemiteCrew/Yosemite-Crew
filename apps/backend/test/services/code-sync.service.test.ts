import { prisma } from "../../src/config/prisma";
import { CodeSyncService } from "../../src/services/code-sync.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    codeSyncState: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe("CodeSyncService", () => {
  const mockedPrisma = prisma as unknown as {
    codeSyncState: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads code sync state using the composite unique key", async () => {
    mockedPrisma.codeSyncState.findUnique.mockResolvedValue({
      system: "IDEXX",
      kind: "tests",
      version: "v1",
      lastSyncedAt: null,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      updatedAt: new Date("2026-06-19T10:00:00.000Z"),
    });

    await expect(CodeSyncService.get("IDEXX", "tests")).resolves.toEqual({
      system: "IDEXX",
      kind: "tests",
      version: "v1",
      lastSyncedAt: null,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      updatedAt: new Date("2026-06-19T10:00:00.000Z"),
    });

    expect(mockedPrisma.codeSyncState.findUnique).toHaveBeenCalledWith({
      where: {
        system_kind: {
          system: "IDEXX",
          kind: "tests",
        },
      },
    });
  });

  it("upserts code sync state with a null lastSyncedAt default", async () => {
    mockedPrisma.codeSyncState.upsert.mockResolvedValue({
      system: "IDEXX",
      kind: "species",
      version: "v2",
      lastSyncedAt: null,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      updatedAt: new Date("2026-06-19T10:00:00.000Z"),
    });

    await expect(
      CodeSyncService.upsert({
        system: "IDEXX",
        kind: "species",
        version: "v2",
      }),
    ).resolves.toEqual({
      system: "IDEXX",
      kind: "species",
      version: "v2",
      lastSyncedAt: null,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      updatedAt: new Date("2026-06-19T10:00:00.000Z"),
    });

    expect(mockedPrisma.codeSyncState.upsert).toHaveBeenCalledWith({
      where: {
        system_kind: {
          system: "IDEXX",
          kind: "species",
        },
      },
      create: {
        system: "IDEXX",
        kind: "species",
        version: "v2",
        lastSyncedAt: null,
      },
      update: {
        version: "v2",
        lastSyncedAt: null,
      },
    });
  });

  it("upserts code sync state with the provided lastSyncedAt value", async () => {
    const lastSyncedAt = new Date("2026-06-20T11:30:00.000Z");

    mockedPrisma.codeSyncState.upsert.mockResolvedValue({
      system: "IDEXX",
      kind: "breeds",
      version: "v3",
      lastSyncedAt,
      createdAt: new Date("2026-06-19T10:00:00.000Z"),
      updatedAt: new Date("2026-06-20T11:30:00.000Z"),
    });

    await CodeSyncService.upsert({
      system: "IDEXX",
      kind: "breeds",
      version: "v3",
      lastSyncedAt,
    });

    expect(mockedPrisma.codeSyncState.upsert).toHaveBeenCalledWith({
      where: {
        system_kind: {
          system: "IDEXX",
          kind: "breeds",
        },
      },
      create: {
        system: "IDEXX",
        kind: "breeds",
        version: "v3",
        lastSyncedAt,
      },
      update: {
        version: "v3",
        lastSyncedAt,
      },
    });
  });
});
