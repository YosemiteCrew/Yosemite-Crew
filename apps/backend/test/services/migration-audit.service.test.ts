import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { prisma } from "src/config/prisma";
import {
  generatePresignedUrl,
  readObjectBounded,
} from "src/middlewares/upload";
import { MigrationAuditQueue } from "src/queues/migration-audit.queue";
import {
  createMigrationAuditRun,
  getMigrationAuditRun,
  mintMigrationAuditUploadUrl,
  runMigrationAudit,
} from "src/services/migration-audit.service";

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  generatePresignedUrl: jest.fn(),
  readObjectBounded: jest.fn(),
  CSV_MIME_TYPES: new Set(["text/csv"]),
}));

jest.mock("src/queues/migration-audit.queue", () => ({
  __esModule: true,
  MigrationAuditQueue: { add: jest.fn() },
  MigrationAuditJobs: { RUN: "run" },
}));

jest.mock("src/config/prisma", () => ({
  __esModule: true,
  prisma: {
    migrationAuditRun: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    migrationAuditIssue: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

const mockedPrisma = prisma as unknown as {
  migrationAuditRun: {
    create: jest.Mock<any>;
    findFirst: jest.Mock<any>;
    findUnique: jest.Mock<any>;
    update: jest.Mock<any>;
  };
  migrationAuditIssue: {
    deleteMany: jest.Mock<any>;
    createMany: jest.Mock<any>;
  };
  $transaction: jest.Mock<any>;
};
const mockedReadObjectBounded = readObjectBounded as jest.Mock<any>;
const mockedGeneratePresignedUrl = generatePresignedUrl as jest.Mock<any>;

const VALID_OWNERS =
  "external_id,first_name,last_name,email,phone\nown-1,Alex,Rivera,alex@example.test,555";
const VALID_ANIMALS =
  "external_id,owner_external_id,name,species,date_of_birth\nani-1,own-1,Biscuit,dog,2019-04-01";
const VALID_APPOINTMENTS =
  "external_id,animal_external_id,owner_external_id,date,reason\napt-1,ani-1,own-1,2026-01-10,checkup";

describe("migration-audit.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("mintMigrationAuditUploadUrl", () => {
    it("mints a presigned URL scoped to the organisation with the CSV allowlist", async () => {
      mockedGeneratePresignedUrl.mockResolvedValue({
        url: "https://s3/put",
        key: "orgs/org-1/abc.csv",
      });

      const result = await mintMigrationAuditUploadUrl("org-1");

      expect(generatePresignedUrl).toHaveBeenCalledWith(
        "text/csv",
        "org",
        "org-1",
        expect.any(Set),
      );
      expect(result).toEqual({
        url: "https://s3/put",
        key: "orgs/org-1/abc.csv",
      });
    });
  });

  describe("createMigrationAuditRun", () => {
    const baseInput = {
      organisationId: "org-1",
      createdByUserId: "user-1",
      sourceKeys: {
        owners: "orgs/org-1/owners.csv",
        animals: "orgs/org-1/animals.csv",
        appointments: "orgs/org-1/appointments.csv",
      },
    };

    it("rejects a request missing a required file, as a 400", async () => {
      await expect(
        createMigrationAuditRun({
          ...baseInput,
          sourceKeys: {
            owners: "orgs/org-1/owners.csv",
            animals: "orgs/org-1/animals.csv",
            appointments: "" as unknown as string,
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockedPrisma.migrationAuditRun.create).not.toHaveBeenCalled();
    });

    it("rejects a source key that does not belong to the caller's organisation, as a 400", async () => {
      await expect(
        createMigrationAuditRun({
          ...baseInput,
          sourceKeys: {
            ...baseInput.sourceKeys,
            owners: "orgs/org-OTHER/owners.csv",
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(mockedPrisma.migrationAuditRun.create).not.toHaveBeenCalled();
    });

    it("creates a run and enqueues a job on success", async () => {
      mockedPrisma.migrationAuditRun.create.mockResolvedValue({
        id: "run-1",
        status: "PENDING",
      });

      const run = await createMigrationAuditRun(baseInput);

      expect(mockedPrisma.migrationAuditRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organisationId: "org-1",
            createdByUserId: "user-1",
            status: "PENDING",
            sourceFiles: baseInput.sourceKeys,
          }),
        }),
      );
      expect(MigrationAuditQueue.add).toHaveBeenCalledWith("run", {
        auditRunId: "run-1",
      });
      expect(run).toEqual({ id: "run-1", status: "PENDING" });
    });

    it("produces the same inputHash for the same keys, and a different one for different keys", async () => {
      mockedPrisma.migrationAuditRun.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: "run-1",
          status: "PENDING",
          inputHash: args.data.inputHash,
        }),
      );

      const first = await createMigrationAuditRun(baseInput);
      const second = await createMigrationAuditRun(baseInput);
      const third = await createMigrationAuditRun({
        ...baseInput,
        sourceKeys: {
          ...baseInput.sourceKeys,
          owners: "orgs/org-1/different.csv",
        },
      });

      expect((first as any).inputHash).toBe((second as any).inputHash);
      expect((first as any).inputHash).not.toBe((third as any).inputHash);
    });
  });

  describe("getMigrationAuditRun", () => {
    it("throws a 404 when no run matches the id and organisation", async () => {
      mockedPrisma.migrationAuditRun.findFirst.mockResolvedValue(null);

      await expect(
        getMigrationAuditRun("org-1", "run-1"),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns the run scoped to the organisation, with issues", async () => {
      mockedPrisma.migrationAuditRun.findFirst.mockResolvedValue({
        id: "run-1",
        organisationId: "org-1",
        issues: [{ id: "issue-1" }],
      });

      const run = await getMigrationAuditRun("org-1", "run-1");

      expect(mockedPrisma.migrationAuditRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "run-1", organisationId: "org-1" },
        }),
      );
      expect(run.issues).toEqual([{ id: "issue-1" }]);
    });
  });

  describe("runMigrationAudit", () => {
    it("does nothing (and does not throw) when the run no longer exists", async () => {
      mockedPrisma.migrationAuditRun.findUnique.mockResolvedValue(null);

      await expect(runMigrationAudit("missing-run")).resolves.toBeUndefined();
      expect(mockedPrisma.migrationAuditRun.update).not.toHaveBeenCalled();
    });

    it("reads each source file bounded, runs the planner, and persists COMPLETED with the summary", async () => {
      mockedPrisma.migrationAuditRun.findUnique.mockResolvedValue({
        id: "run-1",
        sourceFiles: {
          owners: "orgs/org-1/owners.csv",
          animals: "orgs/org-1/animals.csv",
          appointments: "orgs/org-1/appointments.csv",
        },
      });
      mockedReadObjectBounded.mockImplementation((key: string) => {
        if (key.includes("owners"))
          return Promise.resolve(Buffer.from(VALID_OWNERS));
        if (key.includes("animals"))
          return Promise.resolve(Buffer.from(VALID_ANIMALS));
        return Promise.resolve(Buffer.from(VALID_APPOINTMENTS));
      });

      await runMigrationAudit("run-1");

      expect(mockedPrisma.migrationAuditRun.update).toHaveBeenNthCalledWith(1, {
        where: { id: "run-1" },
        data: { status: "RUNNING" },
      });
      expect(mockedPrisma.migrationAuditIssue.deleteMany).toHaveBeenCalledWith({
        where: { auditRunId: "run-1" },
      });
      const createManyCall = mockedPrisma.migrationAuditIssue.createMany.mock
        .calls[0][0] as { data: unknown[] };
      // No attachment manifest was supplied, so the only issue is the
      // informational "not provided" note - no owners/animals/appointments
      // findings, since the bundle is internally consistent.
      expect(createManyCall.data).toEqual([
        expect.objectContaining({ code: "attachment_manifest_not_provided" }),
      ]);
      const finalUpdate = mockedPrisma.migrationAuditRun.update.mock
        .calls[1][0] as { where: unknown; data: any };
      expect(finalUpdate.where).toEqual({ id: "run-1" });
      expect(finalUpdate.data.status).toBe("COMPLETED");
      expect(finalUpdate.data.summary.OWNERS).toMatchObject({
        status: "ASSESSED",
        totalRows: 1,
      });
    });

    it("marks the run FAILED with the error message when a source read fails", async () => {
      mockedPrisma.migrationAuditRun.findUnique.mockResolvedValue({
        id: "run-1",
        sourceFiles: {
          owners: "orgs/org-1/owners.csv",
          animals: "x",
          appointments: "y",
        },
      });
      mockedReadObjectBounded.mockRejectedValue(new Error("object too large"));

      await runMigrationAudit("run-1");

      const failUpdate = mockedPrisma.migrationAuditRun.update.mock
        .calls[1][0] as { data: any };
      expect(failUpdate.data.status).toBe("FAILED");
      expect(failUpdate.data.errorMessage).toBe("object too large");
    });

    it("falls back to a generic message when a non-Error value is thrown", async () => {
      mockedPrisma.migrationAuditRun.findUnique.mockResolvedValue({
        id: "run-1",
        sourceFiles: {
          owners: "orgs/org-1/owners.csv",
          animals: "x",
          appointments: "y",
        },
      });
      mockedReadObjectBounded.mockRejectedValue("not an Error instance");

      await runMigrationAudit("run-1");

      const failUpdate = mockedPrisma.migrationAuditRun.update.mock
        .calls[1][0] as { data: any };
      expect(failUpdate.data.errorMessage).toBe("Unknown error");
    });

    it("skips a role with no source key rather than reading an empty string from S3", async () => {
      mockedPrisma.migrationAuditRun.findUnique.mockResolvedValue({
        id: "run-1",
        sourceFiles: {
          owners: "orgs/org-1/owners.csv",
          animals: "orgs/org-1/animals.csv",
          appointments: "orgs/org-1/appointments.csv",
          attachments: "",
        },
      });
      mockedReadObjectBounded.mockImplementation((key: string) => {
        if (key.includes("owners"))
          return Promise.resolve(Buffer.from(VALID_OWNERS));
        if (key.includes("animals"))
          return Promise.resolve(Buffer.from(VALID_ANIMALS));
        return Promise.resolve(Buffer.from(VALID_APPOINTMENTS));
      });

      await runMigrationAudit("run-1");

      expect(readObjectBounded).toHaveBeenCalledTimes(3);
      const finalUpdate = mockedPrisma.migrationAuditRun.update.mock
        .calls[1][0] as { where: unknown; data: any };
      expect(finalUpdate.data.status).toBe("COMPLETED");
    });
  });
});
