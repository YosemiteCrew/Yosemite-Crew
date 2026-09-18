jest.mock("src/config/prisma", () => ({
  prisma: {
    contactRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import {
  planBackfill,
  runBackfill,
  parseArgs,
  parseDate,
} from "src/scripts/backfill-contact-submissions";

const contactRequestCount = (
  prisma as unknown as { contactRequest: { count: jest.Mock } }
).contactRequest.count;
const contactRequestFindMany = (
  prisma as unknown as { contactRequest: { findMany: jest.Mock } }
).contactRequest.findMany;

const makeResponse = (ok = true, status = 200) =>
  ({ ok, status }) as unknown as Response;

const originalFetch = globalThis.fetch;
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  process.env = originalEnv;
  globalThis.fetch = originalFetch;
});

describe("parseDate", () => {
  it("parses a valid ISO timestamp", () => {
    expect(parseDate("2026-09-01T12:34:56.789Z", "test")).toEqual(
      new Date("2026-09-01T12:34:56.789Z"),
    );
  });

  it("throws on an invalid timestamp", () => {
    expect(() => parseDate("not-a-date", "test")).toThrow(
      "test must be a valid ISO timestamp.",
    );
  });
});

describe("parseArgs", () => {
  it("parses --apply flag", () => {
    expect(parseArgs(["--apply"])).toEqual({ apply: true });
  });

  it("parses --since and --until", () => {
    const since = "2026-01-01T00:00:00.000Z";
    const until = "2026-12-31T23:59:59.999Z";
    expect(parseArgs(["--since", since, "--until", until])).toEqual({
      apply: false,
      since: new Date(since),
      until: new Date(until),
    });
  });

  it("parses --batch-size", () => {
    expect(parseArgs(["--batch-size", "25"])).toEqual({
      apply: false,
      batchSize: 25,
    });
  });

  it("rejects non-integer batch size", () => {
    expect(() => parseArgs(["--batch-size", "abc"])).toThrow(
      "--batch-size must be a positive integer.",
    );
  });

  it("rejects unknown arguments", () => {
    expect(() => parseArgs(["--unknown"])).toThrow(
      "Unknown argument: --unknown",
    );
  });
});

describe("planBackfill", () => {
  beforeEach(() => {
    contactRequestCount.mockResolvedValue(42);
  });

  it("counts all web-sourced requests by default", async () => {
    const result = await planBackfill({});
    expect(contactRequestCount).toHaveBeenCalledWith({
      where: { source: { in: ["PMS_WEB", "MARKETING_SITE"] } },
    });
    expect(result.total).toBe(42);
  });

  it("filters by --since", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    await planBackfill({ since });
    expect(contactRequestCount).toHaveBeenCalledWith({
      where: {
        source: { in: ["PMS_WEB", "MARKETING_SITE"] },
        createdAt: { gt: since },
      },
    });
  });

  it("filters by --until", async () => {
    const until = new Date("2026-12-31T23:59:59.999Z");
    await planBackfill({ until });
    expect(contactRequestCount).toHaveBeenCalledWith({
      where: {
        source: { in: ["PMS_WEB", "MARKETING_SITE"] },
        createdAt: { lte: until },
      },
    });
  });

  it("filters by both --since and --until", async () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const until = new Date("2026-12-31T23:59:59.999Z");
    await planBackfill({ since, until });
    expect(contactRequestCount).toHaveBeenCalledWith({
      where: {
        source: { in: ["PMS_WEB", "MARKETING_SITE"] },
        createdAt: { gt: since, lte: until },
      },
    });
  });
});

describe("runBackfill", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.SUPERADMIN_CONTACT_INTAKE_URL =
      "https://panel.example.com/api/contact";
    process.env.SUPERADMIN_CONTACT_INTAKE_KEY = "shared-secret";
    // Reset the findMany mock implementation to avoid sequence exhaustion across tests
    contactRequestFindMany.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  const makeRequests = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `req-${i + 1}`,
      type: "GENERAL_ENQUIRY",
      source: "PMS_WEB",
      message: `Message ${i + 1}`,
      complaintContext: { fullName: `Name ${i + 1}`, phone: "+1555000000" },
      email: `user${i + 1}@example.com`,
      organisationId: null,
      dsarDetails: null,
      attachments: null,
      createdAt: new Date(`2026-09-01T12:34:5${i}.000Z`),
    }));

  it("returns dry run result without --apply", async () => {
    contactRequestCount.mockResolvedValue(3);
    const result = await runBackfill({});
    expect(result).toEqual({ total: 3, forwarded: 0, skipped: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards requests in batches", async () => {
    const requests = makeRequests(3);
    contactRequestFindMany
      .mockResolvedValueOnce(requests)
      .mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue(makeResponse());

    const result = await runBackfill({ apply: true, batchSize: 2 });

    expect(result.total).toBe(3);
    expect(result.forwarded).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("counts failed requests", async () => {
    const requests = makeRequests(2);
    contactRequestFindMany
      .mockResolvedValueOnce(requests)
      .mockResolvedValueOnce([]);
    fetchMock
      .mockResolvedValueOnce(makeResponse())
      .mockResolvedValueOnce(makeResponse(false, 500));

    const result = await runBackfill({ apply: true });

    expect(result.forwarded).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("counts network errors as failures", async () => {
    const requests = makeRequests(1);
    contactRequestFindMany
      .mockResolvedValueOnce(requests)
      .mockResolvedValueOnce([]);
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await runBackfill({ apply: true });

    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("skips requests missing required web fields", async () => {
    const requests = [
      {
        id: "req-1",
        type: "GENERAL_ENQUIRY",
        source: "PMS_WEB",
        message: "Message 1",
        complaintContext: { fullName: "", phone: "+1555000000" },
        email: "user1@example.com",
        organisationId: null,
        dsarDetails: null,
        attachments: null,
        createdAt: new Date("2026-09-01T12:34:56.000Z"),
      },
      {
        id: "req-2",
        type: "GENERAL_ENQUIRY",
        source: "PMS_WEB",
        message: "Message 2",
        complaintContext: { fullName: "Name 2", phone: "+1555000000" },
        email: "",
        organisationId: null,
        dsarDetails: null,
        attachments: null,
        createdAt: new Date("2026-09-01T12:34:57.000Z"),
      },
    ];
    contactRequestFindMany
      .mockResolvedValueOnce(requests)
      .mockResolvedValueOnce([]);

    const result = await runBackfill({ apply: true });

    expect(result.total).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.forwarded).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses cursor pagination with compound ordering", async () => {
    const requests1 = makeRequests(2);
    const requests2 = makeRequests(1);
    contactRequestFindMany
      .mockResolvedValueOnce(requests1)
      .mockResolvedValueOnce(requests2)
      .mockResolvedValueOnce([]);
    fetchMock.mockResolvedValue(makeResponse());

    await runBackfill({ apply: true, batchSize: 2 });

    expect(contactRequestFindMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 2,
    });
    expect(contactRequestFindMany.mock.calls[1][0]).toMatchObject({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 2,
      skip: 1,
      cursor: { id: "req-2" },
    });
  });

  it("throws if environment variables are missing", async () => {
    delete process.env.SUPERADMIN_CONTACT_INTAKE_URL;
    await expect(runBackfill({ apply: true })).rejects.toThrow(
      "SUPERADMIN_CONTACT_INTAKE_URL and SUPERADMIN_CONTACT_INTAKE_KEY must be configured",
    );
  });
});
