const warnMock = jest.fn();
const errorMock = jest.fn();

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: errorMock,
    info: jest.fn(),
    warn: warnMock,
    debug: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    superadminContactForward: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "src/config/prisma";
import {
  backoffMs,
  FORWARD_BATCH_SIZE,
  parseRetryAfterSeconds,
  SuperadminContactService,
} from "../../src/services/superadmin-contact.service";

const forwards = (
  prisma as unknown as {
    superadminContactForward: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  }
).superadminContactForward;

const NOW = new Date("2026-09-19T12:00:00.000Z");

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  contactRequestId: "req-1",
  attempts: 0,
  contactRequest: {
    id: "req-1",
    createdAt: new Date("2026-08-01T09:30:00.000Z"),
    email: "ada@example.com",
    type: "GENERAL_ENQUIRY",
    message: "my dog ate the invoice",
    complaintContext: { fullName: "Ada Lovelace", phone: "+441234567890" },
  },
  ...overrides,
});

const respond = (
  status: number,
  headers: Record<string, string> = {},
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }) as unknown as Response;

const dataOf = (call: number): Record<string, unknown> =>
  (forwards.update.mock.calls[call][0] as { data: Record<string, unknown> })
    .data;

describe("SuperadminContactService", () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    forwards.findMany.mockResolvedValue([]);
    forwards.findFirst.mockResolvedValue(null);
    forwards.count.mockResolvedValue(0);
    forwards.update.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  const configure = () => {
    process.env.SUPERADMIN_CONTACT_INTAKE_URL =
      "https://panel.example.com/api/contact";
    process.env.SUPERADMIN_CONTACT_INTAKE_KEY = "shared-secret";
  };

  describe("warnIfUnconfigured", () => {
    it("warns once naming the missing URL and how much has queued behind it", async () => {
      process.env.SUPERADMIN_CONTACT_INTAKE_KEY = "shared-secret";
      delete process.env.SUPERADMIN_CONTACT_INTAKE_URL;
      forwards.count.mockResolvedValue(7);

      await SuperadminContactService.warnIfUnconfigured();

      expect(warnMock).toHaveBeenCalledTimes(1);
      expect(warnMock).toHaveBeenCalledWith(
        "SuperAdmin contact mirroring is not configured",
        { missing: "SUPERADMIN_CONTACT_INTAKE_URL", pending: 7 },
      );
    });

    it("names the key when that is the missing one", async () => {
      process.env.SUPERADMIN_CONTACT_INTAKE_URL =
        "https://panel.example.com/api/contact";
      delete process.env.SUPERADMIN_CONTACT_INTAKE_KEY;

      await SuperadminContactService.warnIfUnconfigured();

      expect(warnMock).toHaveBeenCalledWith(
        "SuperAdmin contact mirroring is not configured",
        { missing: "SUPERADMIN_CONTACT_INTAKE_KEY", pending: 0 },
      );
    });

    it("says nothing when both are set", async () => {
      configure();
      await SuperadminContactService.warnIfUnconfigured();
      expect(warnMock).not.toHaveBeenCalled();
      expect(forwards.count).not.toHaveBeenCalled();
    });
  });

  describe("drainForwards", () => {
    it("sends nothing while unconfigured, and leaves the rows pending", async () => {
      delete process.env.SUPERADMIN_CONTACT_INTAKE_URL;
      delete process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
      forwards.count.mockResolvedValue(3);
      forwards.findFirst.mockResolvedValue({
        createdAt: new Date("2026-09-19T11:59:00.000Z"),
      });

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(forwards.findMany).not.toHaveBeenCalled();
      expect(forwards.update).not.toHaveBeenCalled();
      // Unconfigured is a backlog, not a loss: the rows are still counted and
      // still reported as ageing.
      expect(summary).toEqual({
        delivered: 0,
        retrying: 0,
        failed: 0,
        pending: 3,
        oldestPendingSeconds: 60,
      });
    });

    it("claims only due, undelivered, unfailed rows, oldest first, one batch at a time", async () => {
      configure();

      await SuperadminContactService.drainForwards(NOW);

      expect(forwards.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deliveredAt: null,
            failedAt: null,
            nextAttemptAt: { lte: NOW },
          },
          orderBy: [{ nextAttemptAt: "asc" }, { contactRequestId: "asc" }],
          take: FORWARD_BATCH_SIZE,
        }),
      );
      // The batch size is the rate limit. The panel allows 20 requests per 60
      // seconds per client and this job is the mirror's only sender.
      expect(FORWARD_BATCH_SIZE).toBeLessThan(20);
    });

    it("posts the rebuilt submission with the shared key and a timeout, then marks it delivered", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockResolvedValue(respond(200));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://panel.example.com/api/contact");
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "content-type": "application/json",
        "x-contact-key": "shared-secret",
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
      // submittedAt is the ORIGINAL submission time, not the send time: a
      // backfilled row must land in the CRM dated when the person wrote in.
      expect(JSON.parse(init.body as string)).toEqual({
        sourceRequestId: "req-1",
        submittedAt: "2026-08-01T09:30:00.000Z",
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        phone: "+441234567890",
        type: "GENERAL_ENQUIRY",
        message: "my dog ate the invoice",
      });

      expect(forwards.update).toHaveBeenCalledWith({
        where: { contactRequestId: "req-1" },
        data: { deliveredAt: NOW, lastAttemptAt: NOW, lastStatus: 200 },
      });
      expect(summary).toMatchObject({ delivered: 1, retrying: 0, failed: 0 });
    });

    it("sends the fields the panel stores and no others", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockResolvedValue(respond(200));

      await SuperadminContactService.drainForwards(NOW);

      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      // dsarDetails, attachments and organisationId are deliberately absent:
      // the panel stores none of them, so sending them would copy personal
      // data into a system that has no use for it.
      expect(Object.keys(body).sort()).toEqual([
        "email",
        "fullName",
        "message",
        "phone",
        "sourceRequestId",
        "submittedAt",
        "type",
      ]);
    });

    it("omits phone when the stored context has none, and survives a context that is not an object", async () => {
      configure();
      forwards.findMany.mockResolvedValue([
        makeRow({
          contactRequest: {
            ...makeRow().contactRequest,
            complaintContext: { fullName: "Ada Lovelace" },
          },
        }),
        makeRow({
          contactRequestId: "req-2",
          contactRequest: {
            ...makeRow().contactRequest,
            id: "req-2",
            complaintContext: "not-an-object",
          },
        }),
      ]);
      fetchMock.mockResolvedValue(respond(200));

      await SuperadminContactService.drainForwards(NOW);

      const first = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(first).not.toHaveProperty("phone");
      // A row whose context is unreadable still SENDS. Refusing it would
      // strand the submission in exactly the way this queue exists to prevent.
      const second = JSON.parse(
        (fetchMock.mock.calls[1][1] as RequestInit).body as string,
      );
      expect(second.sourceRequestId).toBe("req-2");
      expect(second).not.toHaveProperty("fullName");
    });

    it("sends a row whose context is an array or absent rather than stranding it", async () => {
      configure();
      forwards.findMany.mockResolvedValue([
        makeRow({
          contactRequest: {
            ...makeRow().contactRequest,
            complaintContext: ["Ada Lovelace"],
          },
        }),
        makeRow({
          contactRequestId: "req-2",
          contactRequest: {
            ...makeRow().contactRequest,
            id: "req-2",
            complaintContext: null,
          },
        }),
        makeRow({
          contactRequestId: "req-3",
          contactRequest: {
            ...makeRow().contactRequest,
            id: "req-3",
            complaintContext: { phone: "+441234567890" },
          },
        }),
      ]);
      fetchMock.mockResolvedValue(respond(200));

      const summary = await SuperadminContactService.drainForwards(NOW);

      // An array is an object to typeof, so reading fullName off it would
      // yield undefined silently; every row still goes, with the message and
      // address the panel actually needs.
      for (const call of fetchMock.mock.calls) {
        const body = JSON.parse((call[1] as RequestInit).body as string);
        expect(body).not.toHaveProperty("fullName");
        expect(body.message).toBe("my dog ate the invoice");
      }
      expect(summary).toMatchObject({ delivered: 3 });
    });

    it("marks a 400 failed and never retries it, logging the id only", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockResolvedValue(respond(400));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(dataOf(0)).toEqual({
        failedAt: NOW,
        lastAttemptAt: NOW,
        lastStatus: 400,
      });
      expect(summary).toMatchObject({ failed: 1, delivered: 0, retrying: 0 });
      expect(errorMock).toHaveBeenCalledWith(
        "SuperAdmin contact intake refused a forward",
        { contactRequestId: "req-1", status: 400 },
      );
      // The log carries the id and the status. Not the message, not the
      // address, not the name.
      const logged = JSON.stringify(errorMock.mock.calls[0]);
      expect(logged).not.toContain("ada@example.com");
      expect(logged).not.toContain("Ada Lovelace");
      expect(logged).not.toContain("my dog ate the invoice");
    });

    it("marks a 409 failed too", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockResolvedValue(respond(409));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(dataOf(0)).toMatchObject({ failedAt: NOW, lastStatus: 409 });
      expect(summary).toMatchObject({ failed: 1 });
    });

    it("backs a 401 off and keeps it pending, because a fixed key must drain by itself", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow({ attempts: 2 })]);
      fetchMock.mockResolvedValue(respond(401));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(dataOf(0)).toEqual({
        attempts: 3,
        nextAttemptAt: new Date(NOW.getTime() + 8 * 60_000),
        lastAttemptAt: NOW,
        lastStatus: 401,
      });
      expect(summary).toMatchObject({ retrying: 1, failed: 0 });
    });

    it("backs a 500 off the same way", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockResolvedValue(respond(503));

      await SuperadminContactService.drainForwards(NOW);

      expect(dataOf(0)).toMatchObject({ attempts: 1, lastStatus: 503 });
    });

    it("records a network failure with no status and without logging the error", async () => {
      configure();
      forwards.findMany.mockResolvedValue([makeRow()]);
      fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(dataOf(0)).toEqual({
        attempts: 1,
        nextAttemptAt: new Date(NOW.getTime() + 2 * 60_000),
        lastAttemptAt: NOW,
        lastStatus: null,
      });
      expect(summary).toMatchObject({ retrying: 1 });
      // A fetch error can quote the request, and the request body is personal
      // data. The tick line is what reports this instead.
      expect(errorMock).not.toHaveBeenCalled();
    });

    it("stops the whole tick on a 429 and leaves the rest of the batch untouched", async () => {
      configure();
      forwards.findMany.mockResolvedValue([
        makeRow(),
        makeRow({ contactRequestId: "req-2" }),
        makeRow({ contactRequestId: "req-3" }),
      ]);
      fetchMock.mockResolvedValue(respond(429, { "retry-after": "90" }));

      const summary = await SuperadminContactService.drainForwards(NOW);

      // One send, one update. The other two rows keep their nextAttemptAt and
      // burn no attempt - the panel refused the client, not the content.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(forwards.update).toHaveBeenCalledTimes(1);
      expect(dataOf(0)).toEqual({
        nextAttemptAt: new Date(NOW.getTime() + 90_000),
        lastAttemptAt: NOW,
        lastStatus: 429,
      });
      // A 429 is not an attempt against the content, so attempts is untouched.
      expect(dataOf(0)).not.toHaveProperty("attempts");
      expect(summary).toMatchObject({ retrying: 1, delivered: 0, failed: 0 });
    });

    it("continues the batch after a delivery and a retry", async () => {
      configure();
      forwards.findMany.mockResolvedValue([
        makeRow(),
        makeRow({ contactRequestId: "req-2" }),
        makeRow({ contactRequestId: "req-3" }),
      ]);
      fetchMock
        .mockResolvedValueOnce(respond(200))
        .mockResolvedValueOnce(respond(500))
        .mockResolvedValueOnce(respond(400));

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(summary).toMatchObject({ delivered: 1, retrying: 1, failed: 1 });
    });

    it("reports the pending backlog and the age of its oldest row", async () => {
      configure();
      forwards.count.mockResolvedValue(4);
      forwards.findFirst.mockResolvedValue({
        createdAt: new Date("2026-09-19T10:30:30.000Z"),
      });

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(forwards.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deliveredAt: null, failedAt: null },
          orderBy: { createdAt: "asc" },
        }),
      );
      expect(summary).toMatchObject({
        pending: 4,
        oldestPendingSeconds: 5370,
      });
    });

    it("reports a null age rather than querying for one when nothing is pending", async () => {
      configure();
      forwards.count.mockResolvedValue(0);

      const summary = await SuperadminContactService.drainForwards(NOW);

      expect(forwards.findFirst).not.toHaveBeenCalled();
      expect(summary.oldestPendingSeconds).toBeNull();
    });
  });

  describe("parseRetryAfterSeconds", () => {
    it("reads a delta in seconds", () => {
      expect(parseRetryAfterSeconds("120", NOW)).toBe(120);
      expect(parseRetryAfterSeconds("  30  ", NOW)).toBe(30);
    });

    it("reads an HTTP date as the distance from now", () => {
      expect(parseRetryAfterSeconds("Sat, 19 Sep 2026 12:02:00 GMT", NOW)).toBe(
        120,
      );
    });

    it("falls back to 60 seconds for absent, unparseable and past values", () => {
      // A NaN here would become an invalid date and, in effect, "retry now" -
      // against the very endpoint that just asked us to slow down.
      expect(parseRetryAfterSeconds(null, NOW)).toBe(60);
      expect(parseRetryAfterSeconds("soon", NOW)).toBe(60);
      expect(parseRetryAfterSeconds("-5", NOW)).toBe(60);
      expect(parseRetryAfterSeconds("Sat, 19 Sep 2026 11:00:00 GMT", NOW)).toBe(
        60,
      );
    });

    it("caps a far-future value at the backoff ceiling", () => {
      // A panel answering with a day would otherwise park that row for a day.
      // An hour is the same ceiling the backoff already uses, and a still-
      // limiting panel just says 429 again.
      expect(parseRetryAfterSeconds("86400", NOW)).toBe(3600);
      expect(parseRetryAfterSeconds("Sun, 20 Sep 2026 12:00:00 GMT", NOW)).toBe(
        3600,
      );
      // Anything under the ceiling is still honoured exactly.
      expect(parseRetryAfterSeconds("3599", NOW)).toBe(3599);
    });
  });

  describe("backoffMs", () => {
    it("doubles per attempt and stops at an hour", () => {
      expect(backoffMs(1)).toBe(2 * 60_000);
      expect(backoffMs(3)).toBe(8 * 60_000);
      expect(backoffMs(5)).toBe(32 * 60_000);
      // Ceiling, so a long outage retries hourly rather than drifting into
      // never: 2^6 is 64, which is past the hour.
      expect(backoffMs(6)).toBe(60 * 60_000);
      expect(backoffMs(40)).toBe(60 * 60_000);
    });
  });
});
