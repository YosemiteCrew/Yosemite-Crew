jest.mock("src/config/prisma", () => ({
  prisma: { auditTrail: { findMany: jest.fn() } },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import {
  AuditTrailService,
  AuditTrailServiceError,
} from "src/services/audit-trail.service";
import { encodeKeysetCursor } from "src/services/shared/pagination";

const findMany = prisma.auditTrail.findMany as jest.Mock;
const firstId = "00000000-0000-4000-8000-000000000001";
const lastId = "00000000-0000-4000-8000-000000000002";
const time = new Date("2026-09-28T09:00:00.000Z");

describe("AuditTrailService.listOrganisationFeed", () => {
  beforeEach(() => jest.clearAllMocks());

  it("scopes by organisation and selects only summary fields", async () => {
    findMany.mockResolvedValue([]);

    await expect(
      AuditTrailService.listOrganisationFeed({ organisationId: "org-a" }),
    ).resolves.toEqual({ entries: [], nextCursor: null });

    expect(findMany).toHaveBeenCalledWith({
      where: { organisationId: "org-a" },
      select: {
        id: true,
        patientId: true,
        eventType: true,
        actorType: true,
        actorName: true,
        entityType: true,
        occurredAt: true,
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 51,
    });
  });

  it("uses a stable timestamp-and-id cursor and caps page size", async () => {
    findMany.mockResolvedValue([
      { id: firstId, occurredAt: time },
      { id: lastId, occurredAt: time },
    ]);
    const cursor = encodeKeysetCursor({ createdAt: time, id: lastId });

    const result = await AuditTrailService.listOrganisationFeed({
      organisationId: "org-a",
      cursor,
      limit: 1,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organisationId: "org-a",
          OR: [
            { occurredAt: { lt: time } },
            { occurredAt: time, id: { lt: lastId } },
          ],
        },
        take: 2,
      }),
    );
    expect(result.entries).toEqual([{ id: firstId, occurredAt: time }]);
    expect(result.nextCursor).toBe(
      encodeKeysetCursor({ createdAt: time, id: firstId }),
    );
  });

  it("caps an oversized page request", async () => {
    findMany.mockResolvedValue([]);

    await AuditTrailService.listOrganisationFeed({
      organisationId: "org-a",
      limit: 500,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    );
  });

  it("falls back to a bounded page size for non-finite internal values", async () => {
    findMany.mockResolvedValue([]);

    await AuditTrailService.listOrganisationFeed({
      organisationId: "org-a",
      limit: Number.NaN,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 51 }),
    );
  });

  it("rejects malformed cursors before querying", async () => {
    await expect(
      AuditTrailService.listOrganisationFeed({
        organisationId: "org-a",
        cursor: "not-a-cursor",
      }),
    ).rejects.toMatchObject<Partial<AuditTrailServiceError>>({
      statusCode: 400,
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
