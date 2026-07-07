import { DeveloperRequestLogService } from "../../src/services/developer-request-log.service";
import { prisma } from "../../src/config/prisma";
import { encodeCursor } from "../../src/utils/cursor-pagination";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerApiRequestLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  developerApiRequestLog: {
    create: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
};

const row = (id: string, createdAt: Date) => ({ id, createdAt });

describe("DeveloperRequestLogService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("record", () => {
    it("persists the entry verbatim", async () => {
      mockPrisma.developerApiRequestLog.create.mockResolvedValue({});
      const entry = {
        organisationId: "org-1",
        apiKeyId: "key-1",
        method: "GET",
        path: "/v1/developer/appointments",
        statusCode: 200,
        durationMs: 12,
        errorCode: null,
        environment: "live" as const,
      };
      await DeveloperRequestLogService.record(entry);
      expect(mockPrisma.developerApiRequestLog.create).toHaveBeenCalledWith({
        data: entry,
      });
    });
  });

  describe("list", () => {
    it("scopes to the org, orders by createdAt desc, and fetches limit+1", async () => {
      mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([]);
      await DeveloperRequestLogService.list({
        organisationId: "org-1",
        limit: 50,
      });

      const arg = mockPrisma.developerApiRequestLog.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ organisationId: "org-1" });
      expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
      expect(arg.take).toBe(51);
    });

    it("applies the apiKeyId filter", async () => {
      mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([]);
      await DeveloperRequestLogService.list({
        organisationId: "org-1",
        limit: 50,
        apiKeyId: "key-1",
      });
      const arg = mockPrisma.developerApiRequestLog.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ organisationId: "org-1", apiKeyId: "key-1" });
    });

    it.each([
      ["2xx", { gte: 200, lt: 300 }],
      ["4xx", { gte: 400, lt: 500 }],
      ["5xx", { gte: 500, lt: 600 }],
    ] as const)(
      "maps statusClass %s to a half-open statusCode range",
      async (statusClass, expected) => {
        mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([]);
        await DeveloperRequestLogService.list({
          organisationId: "org-1",
          limit: 50,
          statusClass,
        });
        const arg = mockPrisma.developerApiRequestLog.findMany.mock.calls[0][0];
        expect(arg.where.statusCode).toEqual(expected);
      },
    );

    it("applies dateFrom/dateTo bounds on createdAt", async () => {
      mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([]);
      await DeveloperRequestLogService.list({
        organisationId: "org-1",
        limit: 50,
        dateFrom: "2026-07-01T00:00:00.000Z",
        dateTo: "2026-07-07T00:00:00.000Z",
      });
      const arg = mockPrisma.developerApiRequestLog.findMany.mock.calls[0][0];
      expect(arg.where.createdAt).toEqual({
        gte: new Date("2026-07-01T00:00:00.000Z"),
        lte: new Date("2026-07-07T00:00:00.000Z"),
      });
    });

    it("AND-merges the keyset cursor with the org-scoped filter", async () => {
      mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([]);
      const cursor = encodeCursor({
        sortKey: "2026-07-06T12:00:00.000Z",
        id: "log-5",
      });
      await DeveloperRequestLogService.list({
        organisationId: "org-1",
        limit: 50,
        cursor,
      });
      const arg = mockPrisma.developerApiRequestLog.findMany.mock.calls[0][0];
      expect(arg.where.AND[0]).toEqual({ organisationId: "org-1" });
      expect(arg.where.AND[1]).toEqual({
        OR: [
          { createdAt: { lt: new Date("2026-07-06T12:00:00.000Z") } },
          {
            createdAt: new Date("2026-07-06T12:00:00.000Z"),
            id: { lt: "log-5" },
          },
        ],
      });
    });

    it("returns a page with nextCursor when there are more rows", async () => {
      const now = new Date();
      mockPrisma.developerApiRequestLog.findMany.mockResolvedValue([
        row("a", now),
        row("b", now),
        row("c", now),
      ]);
      const page = await DeveloperRequestLogService.list({
        organisationId: "org-1",
        limit: 2,
      });
      expect(page.items.map((r) => r.id)).toEqual(["a", "b"]);
      expect(page.pagination.hasMore).toBe(true);
      expect(page.pagination.nextCursor).toEqual(expect.any(String));
      expect(page.pagination.limit).toBe(2);
    });
  });

  describe("deleteOlderThan", () => {
    it("deletes rows older than the cutoff and returns the count", async () => {
      mockPrisma.developerApiRequestLog.deleteMany.mockResolvedValue({
        count: 7,
      });
      const before = Date.now();
      const deleted = await DeveloperRequestLogService.deleteOlderThan(30);
      expect(deleted).toBe(7);

      const arg = mockPrisma.developerApiRequestLog.deleteMany.mock.calls[0][0];
      const cutoff = arg.where.createdAt.lt as Date;
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(
        before - thirtyDaysMs - 1000,
      );
      expect(cutoff.getTime()).toBeLessThanOrEqual(
        Date.now() - thirtyDaysMs + 1000,
      );
    });
  });
});
