import { ParentService } from "../../src/services/parent.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parent: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    parentAddress: { upsert: jest.fn(), deleteMany: jest.fn() },
    parentPatient: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    authUserMobile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("@yosemite-crew/auth", () => ({
  getAuthService: jest.fn(() => null),
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
  buildS3Key: jest.fn(),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromParentRequestDTO: jest.fn((dto) => dto),
  toParentResponseDTO: jest.fn((dto) => dto),
}));

const db = prisma as unknown as {
  parent: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  parentAddress: { upsert: jest.Mock; deleteMany: jest.Mock };
  parentPatient: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  authUserMobile: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
};

const resetAll = () => {
  for (const table of Object.values(db)) {
    for (const mock of Object.values(table)) mock.mockReset();
  }
};

const record = {
  id: "parent-1",
  firstName: "Jane",
  lastName: "Doe",
  birthDate: null,
  email: "jane@example.com",
  phoneNumber: "+15550100",
  currency: null,
  timezone: null,
  profileImageUrl: null,
  isProfileComplete: false,
  linkedUserId: null,
  createdFrom: "pms",
  alerts: [{ label: "VIP" }],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  address: { addressLine: "1 Main St", city: "Austin" },
};

// The only route from a practice to a parent: an ACTIVE parent link to a
// companion that is ACTIVE at that practice.
const scopeFor = (organisationId: string) => ({
  status: "ACTIVE",
  patient: {
    organisations: { some: { organisationId, status: "ACTIVE" } },
  },
});

const pms = { source: "pms" as const, organisationId: "org-1" };

describe("ParentService organisation scope", () => {
  beforeEach(resetAll);

  describe("get", () => {
    it("reads a parent linked to a companion that is ACTIVE at the practice", async () => {
      db.parentPatient.findFirst.mockResolvedValue({ id: "link-1" });
      db.parent.findUnique.mockResolvedValue(record);

      const result = await ParentService.get("parent-1", pms);

      expect(result?.response.id).toBe("parent-1");
      expect(db.parentPatient.findFirst).toHaveBeenCalledWith({
        where: { parentId: "parent-1", ...scopeFor("org-1") },
        select: { id: true },
      });
    });

    it("reads a parent outside the practice as missing", async () => {
      db.parentPatient.findFirst.mockResolvedValue(null);
      db.parent.findUnique.mockResolvedValue(record);

      await expect(ParentService.get("parent-1", pms)).resolves.toBeNull();
      expect(db.parent.findUnique).not.toHaveBeenCalled();
    });

    it("reads nothing when no organisation was resolved", async () => {
      db.parentPatient.findFirst.mockResolvedValue({ id: "link-1" });
      db.parent.findUnique.mockResolvedValue(record);

      await expect(
        ParentService.get("parent-1", { source: "pms" }),
      ).resolves.toBeNull();
      expect(db.parentPatient.findFirst).not.toHaveBeenCalled();
      expect(db.parent.findUnique).not.toHaveBeenCalled();
    });

    it("reads nothing for a mobile caller without a session id", async () => {
      db.parent.findUnique.mockResolvedValue(record);

      await expect(
        ParentService.get("parent-1", { source: "mobile" }),
      ).resolves.toBeNull();
      expect(db.parent.findUnique).not.toHaveBeenCalled();
    });
  });

  it("does not edit a parent outside the practice", async () => {
    db.parentPatient.findFirst.mockResolvedValue(null);
    db.parent.findUnique.mockResolvedValue(record);

    await expect(
      ParentService.update(
        "parent-1",
        { firstName: "Mallory", email: "m@example.com" } as never,
        { ...pms, actorId: "user-1" },
      ),
    ).resolves.toBeNull();
    expect(db.parent.update).not.toHaveBeenCalled();
    expect(db.parentAddress.upsert).not.toHaveBeenCalled();
  });

  it("does not delete a parent outside the practice", async () => {
    db.parentPatient.findFirst.mockResolvedValue(null);
    db.parent.findUnique.mockResolvedValue(record);

    await expect(ParentService.delete("parent-1", pms)).resolves.toBeNull();
    expect(db.parentPatient.deleteMany).not.toHaveBeenCalled();
    expect(db.parent.deleteMany).not.toHaveBeenCalled();
  });

  describe("getByName", () => {
    it("matches only the practice's own clients", async () => {
      db.parentPatient.findMany.mockResolvedValue([
        { parentId: "parent-1" },
        { parentId: "parent-2" },
      ]);
      db.parent.findMany.mockResolvedValue([record]);

      const result = await ParentService.getByName("jane", "org-1");

      expect(db.parentPatient.findMany).toHaveBeenCalledWith({
        where: scopeFor("org-1"),
        select: { parentId: true },
        distinct: ["parentId"],
      });
      expect(db.parent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ["parent-1", "parent-2"] },
          }),
        }),
      );
      expect(result.responses.map((r) => r.id)).toEqual(["parent-1"]);
    });

    it("returns nothing when the practice has no clients yet", async () => {
      db.parentPatient.findMany.mockResolvedValue([]);
      db.parent.findMany.mockResolvedValue([record]);

      const result = await ParentService.getByName("jane", "org-1");

      expect(result.responses).toEqual([]);
      expect(db.parent.findMany).not.toHaveBeenCalled();
    });

    it("requires an organisation", async () => {
      await expect(ParentService.getByName("jane", "  ")).rejects.toMatchObject(
        { statusCode: 400 },
      );
      expect(db.parentPatient.findMany).not.toHaveBeenCalled();
      expect(db.parent.findMany).not.toHaveBeenCalled();
    });
  });

  describe("mayOrganisationAddCompanion", () => {
    it("allows one of the practice's own clients", async () => {
      db.parentPatient.findFirst.mockResolvedValueOnce({ id: "link-1" });

      await expect(
        ParentService.mayOrganisationAddCompanion("parent-1", "org-1"),
      ).resolves.toBe(true);
      expect(db.parent.findUnique).not.toHaveBeenCalled();
    });

    it("allows a client the practice has just entered, before any companion", async () => {
      db.parentPatient.findFirst
        .mockResolvedValueOnce(null) // not a client of org-1
        .mockResolvedValueOnce(null); // no companion links at all
      db.parent.findUnique.mockResolvedValue({
        createdFrom: "pms",
        createdAt: new Date(Date.now() - 14 * 60 * 1000),
      });

      await expect(
        ParentService.mayOrganisationAddCompanion("parent-1", "org-1"),
      ).resolves.toBe(true);
      expect(db.parentPatient.findFirst).toHaveBeenLastCalledWith({
        where: { parentId: "parent-1" },
        select: { id: true },
      });
    });

    it.each([
      [
        "entered more than 15 minutes ago",
        new Date(Date.now() - 16 * 60 * 1000),
      ],
      ["with no creation time", null],
    ])(
      "refuses a link-less practice-entered parent %s",
      async (_label, createdAt) => {
        db.parentPatient.findFirst.mockResolvedValue(null);
        db.parent.findUnique.mockResolvedValue({
          createdFrom: "pms",
          createdAt,
        });

        await expect(
          ParentService.mayOrganisationAddCompanion("parent-1", "org-1"),
        ).resolves.toBe(false);
        expect(db.parent.findUnique).toHaveBeenCalledWith({
          where: { id: "parent-1" },
          select: { createdFrom: true, createdAt: true },
        });
      },
    );

    it("refuses a practice-entered parent that already has companions elsewhere", async () => {
      db.parentPatient.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "link-at-another-practice" });
      db.parent.findUnique.mockResolvedValue({
        createdFrom: "pms",
        createdAt: new Date(),
      });

      await expect(
        ParentService.mayOrganisationAddCompanion("parent-1", "org-1"),
      ).resolves.toBe(false);
    });

    it("refuses an app user who is not a client of the practice", async () => {
      db.parentPatient.findFirst.mockResolvedValue(null);
      db.parent.findUnique.mockResolvedValue({ createdFrom: "mobile" });

      await expect(
        ParentService.mayOrganisationAddCompanion("parent-1", "org-1"),
      ).resolves.toBe(false);
    });

    it("refuses without an organisation", async () => {
      db.parentPatient.findFirst.mockResolvedValue(null);
      db.parent.findUnique.mockResolvedValue({ createdFrom: "pms" });

      await expect(
        ParentService.mayOrganisationAddCompanion("parent-1", " "),
      ).resolves.toBe(false);
      expect(db.parentPatient.findFirst).not.toHaveBeenCalled();
    });
  });
});
