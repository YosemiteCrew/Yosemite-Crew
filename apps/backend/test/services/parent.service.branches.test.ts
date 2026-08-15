import {
  ParentService,
  ParentServiceError,
} from "../../src/services/parent.service";
import { AuthUserMobileService } from "../../src/services/authUserMobile.service";
import { AuditTrailService } from "../../src/services/audit-trail.service";
import { prisma } from "src/config/prisma";
import { moveFile } from "../../src/middlewares/upload";

// Companion suite to parent.service.test.ts. It owns the edge/guard paths (timezone
// parsing, profile-completion recomputation, mobile ownership checks) and resets every
// prisma mock between tests, because `jest.clearAllMocks()` leaves queued
// `mockResolvedValueOnce` values and stale implementations behind.
jest.mock("src/config/prisma", () => ({
  prisma: {
    parent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentAddress: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentPatient: {
      deleteMany: jest.fn(),
    },
    authUserMobile: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getAuthUserMobileIdByProviderId: jest.fn(),
    linkParent: jest.fn(),
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordAlertMutation: jest.fn() },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn(() => "parent/image-key"),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromParentRequestDTO: jest.fn((dto) => dto),
  toParentResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

const mockedPrisma = prisma as unknown as {
  parent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentAddress: { upsert: jest.Mock; deleteMany: jest.Mock };
  parentPatient: { deleteMany: jest.Mock };
  authUserMobile: { findFirst: jest.Mock; updateMany: jest.Mock };
};

const mockedAuth = AuthUserMobileService as unknown as {
  getAuthUserMobileIdByProviderId: jest.Mock;
  linkParent: jest.Mock;
};
const mockedAudit = AuditTrailService as unknown as {
  recordAlertMutation: jest.Mock;
};
const mockedMoveFile = moveFile as jest.Mock;

const baseRecord = {
  id: "parent-1",
  firstName: "Jane",
  lastName: "Doe",
  birthDate: new Date("1990-05-04T00:00:00.000Z"),
  email: "jane@example.com",
  phoneNumber: "+15550100",
  currency: "USD",
  timezone: null,
  profileImageUrl: null,
  isProfileComplete: false,
  linkedUserId: null,
  createdFrom: "pms",
  alerts: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  address: null,
};

const record = (overrides: Record<string, unknown> = {}) => ({
  ...baseRecord,
  ...overrides,
});

const resetAll = () => {
  Object.values(mockedPrisma.parent).forEach((mock) => mock.mockReset());
  Object.values(mockedPrisma.parentAddress).forEach((mock) => mock.mockReset());
  Object.values(mockedPrisma.parentPatient).forEach((mock) => mock.mockReset());
  Object.values(mockedPrisma.authUserMobile).forEach((mock) =>
    mock.mockReset(),
  );
  mockedAuth.getAuthUserMobileIdByProviderId.mockReset();
  mockedAuth.linkParent.mockReset();
  mockedAudit.recordAlertMutation.mockReset();
  mockedMoveFile.mockReset();
};

/** Wire the happy-path prisma calls a PMS create makes. */
const primeCreate = (created = record(), refreshed = record()) => {
  mockedPrisma.parent.findFirst.mockResolvedValue(null);
  mockedPrisma.parent.create.mockResolvedValue(created);
  mockedPrisma.parent.findUnique.mockResolvedValue(refreshed);
  mockedPrisma.parent.update.mockResolvedValue(refreshed);
  mockedPrisma.parentAddress.upsert.mockResolvedValue({});
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dto = (overrides: Record<string, unknown> = {}): any => ({
  firstName: "Jane",
  email: "Jane@Example.com",
  ...overrides,
});

const createdTimezone = () =>
  mockedPrisma.parent.create.mock.calls.at(-1)?.[0]?.data?.timezone;

describe("ParentService timezone validation", () => {
  beforeEach(resetAll);

  it.each([
    ["UTC", "UTC"],
    ["+05:30", "+05:30"],
    ["UTC+05:30", "UTC+05:30"],
    ["-08:00", "-08:00"],
    ["UTC-08:00", "UTC-08:00"],
    ["Asia/Kolkata", "Asia/Kolkata"],
    // A combined "offset - IANA" label is normalized down to the IANA zone.
    ["UTC+05:30 - Asia/Kolkata", "Asia/Kolkata"],
  ])("accepts %s and stores %s", async (input, stored) => {
    primeCreate();

    await ParentService.create(dto({ timezone: input }), { source: "pms" });

    expect(createdTimezone()).toBe(stored);
  });

  it("rejects a whitespace-only timezone as empty", async () => {
    await expect(
      ParentService.create(dto({ timezone: "   " }), { source: "pms" }),
    ).rejects.toMatchObject({
      message: "Timezone cannot be empty.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);

    expect(mockedPrisma.parent.create).not.toHaveBeenCalled();
  });

  it.each([
    ["Mars/Phobos"],
    ["UTC+0530"],
    ["UTC - Asia/Kolkata"],
    ["UTC+05:30 - Mars/Phobos"],
    ["UTC+05:30 - "],
    ["05:30"],
    ["+123:30"],
    ["+05:3"],
    ["+aa:30"],
    ["+05:aa"],
    ["+99:30"],
    ["+-5:30"],
    ["+05:99"],
    ["+:30"],
    ["+05:"],
  ])("rejects %s as an invalid timezone", async (input) => {
    await expect(
      ParentService.create(dto({ timezone: input }), { source: "pms" }),
    ).rejects.toMatchObject({
      message: "Timezone must be a valid IANA timezone or UTC offset.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);

    expect(mockedPrisma.parent.create).not.toHaveBeenCalled();
  });
});

describe("ParentService.create", () => {
  beforeEach(resetAll);

  it("throws 404 when the mobile auth user has no linked record", async () => {
    mockedAuth.getAuthUserMobileIdByProviderId.mockResolvedValue(null);

    await expect(
      ParentService.create(dto(), { source: "mobile", authUserId: "prov-1" }),
    ).rejects.toMatchObject({
      message: "Authenticated user not found.",
      statusCode: 404,
    } satisfies Partial<ParentServiceError>);

    expect(mockedPrisma.parent.create).not.toHaveBeenCalled();
  });

  it("persists an address when any field carries a value", async () => {
    primeCreate();

    await ParentService.create(
      dto({ address: { country: "US", city: null, addressLine: "" } }),
      { source: "pms" },
    );

    expect(mockedPrisma.parentAddress.upsert).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
      create: {
        parentId: "parent-1",
        addressLine: "",
        country: "US",
        // Null columns become undefined so Prisma leaves them unset.
        city: undefined,
        state: undefined,
        postalCode: undefined,
        latitude: undefined,
        longitude: undefined,
      },
      update: expect.objectContaining({ country: "US", city: undefined }),
    });
  });

  it("skips the address upsert when every field is blank", async () => {
    primeCreate();

    await ParentService.create(
      dto({ address: { country: null, city: "", postalCode: undefined } }),
      { source: "pms" },
    );

    expect(mockedPrisma.parentAddress.upsert).not.toHaveBeenCalled();
  });

  it("throws 500 when the created parent cannot be read back", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValue(null);
    mockedPrisma.parent.create.mockResolvedValue(record());
    mockedPrisma.parent.findUnique.mockResolvedValue(null);

    await expect(
      ParentService.create(dto(), { source: "pms" }),
    ).rejects.toMatchObject({
      message: "Parent creation failed.",
      statusCode: 500,
    } satisfies Partial<ParentServiceError>);
  });

  it("throws 500 when the parent disappears before the final read", async () => {
    mockedPrisma.parent.findFirst.mockResolvedValue(null);
    mockedPrisma.parent.create.mockResolvedValue(record());
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce(record())
      .mockResolvedValueOnce(null);

    await expect(
      ParentService.create(dto(), { source: "pms" }),
    ).rejects.toMatchObject({
      message: "Parent creation failed.",
      statusCode: 500,
    } satisfies Partial<ParentServiceError>);
  });

  it("recomputes isProfileComplete when the stored flag disagrees", async () => {
    // Stored flag says complete, but there is no address, so it must be corrected.
    const stale = record({ isProfileComplete: true });
    primeCreate(stale, stale);

    const result = await ParentService.create(dto(), { source: "pms" });

    expect(mockedPrisma.parent.update).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      data: { isProfileComplete: false },
      include: { address: true },
    });
    expect(result.isProfileComplete).toBe(true);
  });

  it("reports an incomplete profile when the stored flag is null", async () => {
    const nullFlag = record({ isProfileComplete: null });
    primeCreate(nullFlag, nullFlag);

    const result = await ParentService.create(dto(), { source: "pms" });

    expect(result.isProfileComplete).toBe(false);
  });

  it("leaves isProfileComplete alone when it already matches", async () => {
    const complete = record({
      isProfileComplete: true,
      address: { addressLine: "1 Main St", country: "US" },
    });
    primeCreate(complete, complete);

    await ParentService.create(dto(), { source: "pms" });

    expect(mockedPrisma.parent.update).not.toHaveBeenCalled();
  });

  it("moves an uploaded profile image and stores the final URL", async () => {
    primeCreate();
    mockedMoveFile.mockResolvedValue("https://cdn.example.com/final.jpg");

    await ParentService.create(
      dto({ profileImageUrl: "https://cdn.example.com/tmp.jpg" }),
      { source: "pms" },
    );

    expect(mockedMoveFile).toHaveBeenCalledWith(
      "https://cdn.example.com/tmp.jpg",
      "parent/image-key",
    );
    expect(mockedPrisma.parent.update).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      data: { profileImageUrl: "https://cdn.example.com/final.jpg" },
    });
  });

  it("swallows a failed image move without failing the create", async () => {
    primeCreate();
    mockedMoveFile.mockRejectedValue(new Error("bad key"));

    const result = await ParentService.create(
      dto({ profileImageUrl: "https://cdn.example.com/tmp.jpg" }),
      { source: "pms" },
    );

    expect(mockedPrisma.parent.update).not.toHaveBeenCalled();
    expect(result.response.id).toBe("parent-1");
  });

  it("does not attempt an image move when no image was supplied", async () => {
    primeCreate();

    await ParentService.create(dto(), { source: "pms" });

    expect(mockedMoveFile).not.toHaveBeenCalled();
  });

  it("does not link the auth user for a non-mobile source", async () => {
    primeCreate();

    await ParentService.create(dto(), { source: "invited" });

    expect(mockedAuth.linkParent).not.toHaveBeenCalled();
    expect(mockedAuth.getAuthUserMobileIdByProviderId).not.toHaveBeenCalled();
    expect(mockedPrisma.parent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdFrom: "invited",
          email: "jane@example.com",
          linkedUserId: undefined,
        }),
      }),
    );
  });
});

describe("ParentService.get", () => {
  beforeEach(resetAll);

  it("returns the parent when the mobile caller owns it", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue({
      parentId: "parent-1",
    });
    mockedPrisma.parent.findUnique.mockResolvedValue(
      record({ isProfileComplete: true }),
    );

    const result = await ParentService.get("parent-1", {
      source: "mobile",
      authUserId: "prov-1",
    });

    expect(result?.isProfileComplete).toBe(true);
    expect(result?.response.id).toBe("parent-1");
  });

  it("returns null when the mobile caller has no parent mapping at all", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue(null);

    await expect(
      ParentService.get("parent-1", { source: "mobile", authUserId: "prov-1" }),
    ).resolves.toBeNull();
    expect(mockedPrisma.parent.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the parent does not exist", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValue(null);

    await expect(ParentService.get("missing")).resolves.toBeNull();
  });

  it("defaults isProfileComplete to false when the column is null", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValue(
      record({ isProfileComplete: null }),
    );

    const result = await ParentService.get("parent-1");

    expect(result?.isProfileComplete).toBe(false);
  });
});

describe("ParentService.update", () => {
  beforeEach(resetAll);

  it("returns null when the parent vanishes after the write", async () => {
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce({ alerts: null })
      .mockResolvedValueOnce(null);
    mockedPrisma.parent.update.mockResolvedValue(record());

    await expect(
      ParentService.update("parent-1", dto(), { source: "pms" }),
    ).resolves.toBeNull();
  });

  it("recomputes isProfileComplete and falls back to the first read", async () => {
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce({ alerts: null })
      .mockResolvedValueOnce(record({ isProfileComplete: true }))
      // The final re-read misses, so the earlier snapshot is reused.
      .mockResolvedValueOnce(null);
    mockedPrisma.parent.update.mockResolvedValue(record());

    const result = await ParentService.update("parent-1", dto(), {
      source: "pms",
    });

    expect(mockedPrisma.parent.update).toHaveBeenLastCalledWith({
      where: { id: "parent-1" },
      data: { isProfileComplete: false },
    });
    expect(result?.isProfileComplete).toBe(false);
    expect(result?.response.id).toBe("parent-1");
  });

  it("skips the completion write when the stored flag already matches", async () => {
    const complete = record({
      isProfileComplete: true,
      address: { addressLine: "1 Main St", country: "US" },
    });
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce({ alerts: null })
      .mockResolvedValue(complete);
    mockedPrisma.parent.update.mockResolvedValue(complete);

    const result = await ParentService.update("parent-1", dto(), {
      source: "pms",
    });

    expect(mockedPrisma.parent.update).toHaveBeenCalledTimes(1);
    expect(result?.isProfileComplete).toBe(true);
  });

  it("upserts the address when the payload carries one", async () => {
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce({ alerts: null })
      .mockResolvedValue(record());
    mockedPrisma.parent.update.mockResolvedValue(record());
    mockedPrisma.parentAddress.upsert.mockResolvedValue({});

    await ParentService.update(
      "parent-1",
      dto({ address: { city: "Austin" } }),
      { source: "pms" },
    );

    expect(mockedPrisma.parentAddress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentId: "parent-1" },
        update: expect.objectContaining({ city: "Austin" }),
      }),
    );
  });

  it("clears alerts to JsonNull on a PMS update that sends none", async () => {
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce({ alerts: [{ title: "Allergy" }] })
      .mockResolvedValue(record());
    mockedPrisma.parent.update.mockResolvedValue(record());

    await ParentService.update("parent-1", dto(), {
      source: "pms",
      organisationId: "org-1",
      actorId: "user-1",
    });

    const data = mockedPrisma.parent.update.mock.calls[0][0].data;
    expect(data).toHaveProperty("alerts");
    expect(data.alerts).not.toBeUndefined();
    expect(mockedAudit.recordAlertMutation).toHaveBeenCalledWith({
      entity: "PARENT",
      organisationId: "org-1",
      patientId: "parent-1",
      actorId: "user-1",
      previousAlerts: [{ title: "Allergy" }],
      nextAlerts: undefined,
    });
  });

  it("audits with an undefined previous set when the parent row is gone", async () => {
    mockedPrisma.parent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(record());
    mockedPrisma.parent.update.mockResolvedValue(record());

    await ParentService.update("parent-1", dto({ alerts: [] }), {
      source: "mobile",
    });

    expect(mockedAudit.recordAlertMutation).toHaveBeenCalledWith(
      expect.objectContaining({ previousAlerts: undefined, nextAlerts: [] }),
    );
  });
});

describe("ParentService.delete", () => {
  beforeEach(resetAll);

  it("returns null when a mobile caller targets a parent they do not own", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue({
      parentId: "other-parent",
    });

    await expect(
      ParentService.delete("parent-1", {
        source: "mobile",
        authUserId: "prov-1",
      }),
    ).resolves.toBeNull();

    expect(mockedPrisma.parent.deleteMany).not.toHaveBeenCalled();
  });

  it("cascades the delete for the mobile owner", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue({
      parentId: "parent-1",
    });
    mockedPrisma.parent.findUnique.mockResolvedValue(record());
    mockedPrisma.parentPatient.deleteMany.mockResolvedValue({ count: 2 });
    mockedPrisma.authUserMobile.updateMany.mockResolvedValue({ count: 1 });
    mockedPrisma.parentAddress.deleteMany.mockResolvedValue({ count: 1 });
    mockedPrisma.parent.deleteMany.mockResolvedValue({ count: 1 });

    const result = await ParentService.delete("parent-1", {
      source: "mobile",
      authUserId: "prov-1",
    });

    expect(result?.id).toBe("parent-1");
    expect(mockedPrisma.authUserMobile.updateMany).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
      data: { parentId: null },
    });
    expect(mockedPrisma.parentAddress.deleteMany).toHaveBeenCalledWith({
      where: { parentId: "parent-1" },
    });
    expect(mockedPrisma.parent.deleteMany).toHaveBeenCalledWith({
      where: { id: "parent-1" },
    });
  });

  it("returns null when the parent does not exist", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValue(null);

    await expect(
      ParentService.delete("parent-1", { source: "pms" }),
    ).resolves.toBeNull();

    expect(mockedPrisma.parentPatient.deleteMany).not.toHaveBeenCalled();
  });
});

describe("ParentService lookups", () => {
  beforeEach(resetAll);

  it("resolves a parent from the linked auth user", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue({
      parentId: "parent-1",
    });
    mockedPrisma.parent.findUnique.mockResolvedValue(record());

    const result = await ParentService.findByLinkedUserId("prov-1");

    expect(mockedPrisma.authUserMobile.findFirst).toHaveBeenCalledWith({
      where: { providerUserId: "prov-1" },
      select: { parentId: true },
    });
    expect(result?.id).toBe("parent-1");
  });

  it("returns null when the auth user carries no parent id", async () => {
    mockedPrisma.authUserMobile.findFirst.mockResolvedValue({
      parentId: null,
    });

    await expect(
      ParentService.findByLinkedUserId("prov-1"),
    ).resolves.toBeNull();
    expect(mockedPrisma.parent.findUnique).not.toHaveBeenCalled();
  });

  it("looks a parent up by its legacy id", async () => {
    mockedPrisma.parent.findUnique.mockResolvedValue(record());

    const result = await ParentService.findByMongoId("parent-1");

    expect(mockedPrisma.parent.findUnique).toHaveBeenCalledWith({
      where: { id: "parent-1" },
      include: { address: true },
    });
    expect(result?.id).toBe("parent-1");
  });

  it("rejects an empty search name", async () => {
    await expect(ParentService.getByName("")).rejects.toMatchObject({
      message: "Name is required for searching.",
      statusCode: 400,
    } satisfies Partial<ParentServiceError>);

    expect(mockedPrisma.parent.findMany).not.toHaveBeenCalled();
  });

  it("escapes LIKE wildcards in the search term", async () => {
    mockedPrisma.parent.findMany.mockResolvedValue([]);

    const result = await ParentService.getByName("  100%_a  ");

    expect(mockedPrisma.parent.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { firstName: { contains: "100\\%\\_a", mode: "insensitive" } },
          { lastName: { contains: "100\\%\\_a", mode: "insensitive" } },
          { email: { contains: "100\\%\\_a", mode: "insensitive" } },
        ],
      },
      include: { address: true },
    });
    expect(result.responses).toEqual([]);
  });
});
