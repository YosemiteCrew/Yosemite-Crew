import { DeveloperUsageService } from "../../src/services/developer-usage.service";
import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "../../src/services/developer-billing.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    developerApiUsage: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    developerSubscription: { findUnique: jest.fn(), findMany: jest.fn() },
    developerMeterEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/developer-billing.service", () => {
  class BillingError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
      public readonly code?: string,
    ) {
      super(message);
    }
  }
  return {
    DeveloperBillingService: { reportUsage: jest.fn() },
    DeveloperBillingServiceError: BillingError,
  };
});

const mockPrisma = prisma as unknown as {
  $transaction: jest.Mock;
  developerApiUsage: {
    upsert: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  developerSubscription: { findUnique: jest.Mock; findMany: jest.Mock };
  developerMeterEvent: {
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
};
const reportUsage = DeveloperBillingService.reportUsage as jest.Mock;

const event = (overrides: Record<string, unknown> = {}) => ({
  id: "meter-event-1",
  ownerUserId: "owner-1",
  billingPeriod: "2026-09",
  callSequence: 7,
  stripeCustomerId: "cus_1",
  attempts: 0,
  ...overrides,
});

describe("DeveloperUsageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (argument) =>
      typeof argument === "function"
        ? argument(mockPrisma)
        : Promise.all(argument),
    );
    mockPrisma.developerMeterEvent.findMany.mockResolvedValue([]);
    mockPrisma.developerMeterEvent.count.mockResolvedValue(0);
    mockPrisma.developerMeterEvent.findFirst.mockResolvedValue(null);
    mockPrisma.developerSubscription.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.restoreAllMocks());

  describe("incrementAndCheck", () => {
    it("does not record or meter test-key traffic", async () => {
      await expect(
        DeveloperUsageService.incrementAndCheck("owner-1", "test"),
      ).resolves.toEqual({ allowed: true, callCount: 0 });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      [1000, true],
      [1001, false],
    ])("enforces the free limit at %i", async (callCount, allowed) => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
        stripeCustomerId: null,
      });
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount });

      await expect(
        DeveloperUsageService.incrementAndCheck("owner-1", "live"),
      ).resolves.toEqual({ allowed, callCount });
      expect(mockPrisma.developerMeterEvent.create).not.toHaveBeenCalled();
    });

    it("records the usage increment and durable meter event in one transaction", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
        stripeCustomerId: "cus_1",
      });
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 7 });

      await expect(
        DeveloperUsageService.incrementAndCheck("owner-1", "live"),
      ).resolves.toEqual({ allowed: true, callCount: 7 });

      expect(mockPrisma.developerApiUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ meteredCallCount: 1 }),
          update: expect.objectContaining({
            meteredCallCount: { increment: 1 },
          }),
        }),
      );
      expect(mockPrisma.developerMeterEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: "owner-1",
          callSequence: 7,
          stripeCustomerId: "cus_1",
        }),
      });
      expect(reportUsage).not.toHaveBeenCalled();
    });

    it("retains Pro usage even when its Stripe customer is temporarily missing", async () => {
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
        stripeCustomerId: null,
      });
      mockPrisma.developerApiUsage.upsert.mockResolvedValue({ callCount: 8 });

      await DeveloperUsageService.incrementAndCheck("owner-1", "live");

      expect(mockPrisma.developerMeterEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ stripeCustomerId: null }),
      });
    });

    it("does not acknowledge a call when the atomic write fails", async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error("database down"));
      await expect(
        DeveloperUsageService.incrementAndCheck("owner-1", "live"),
      ).rejects.toThrow("database down");
    });
  });

  describe("drainMeterEvents", () => {
    const now = new Date("2026-09-22T10:00:00.000Z");

    it("delivers a persisted event with its stable id and checkpoints it", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([event()]);
      mockPrisma.developerMeterEvent.count.mockResolvedValue(0);
      reportUsage.mockResolvedValue(undefined);

      await expect(
        DeveloperUsageService.drainMeterEvents(now),
      ).resolves.toEqual({
        delivered: 1,
        retrying: 0,
        pending: 0,
        oldestPendingSeconds: null,
      });
      expect(reportUsage).toHaveBeenCalledWith("cus_1", 1, "meter-event-1");
      expect(mockPrisma.developerMeterEvent.update).toHaveBeenCalledWith({
        where: { id: "meter-event-1" },
        data: expect.objectContaining({ deliveredAt: now, failureCode: null }),
      });
      expect(mockPrisma.developerApiUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lastReportedAt: now } }),
      );
    });

    it("retries an outage after restart without changing the event id", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([event()]);
      mockPrisma.developerMeterEvent.count.mockResolvedValue(1);
      mockPrisma.developerMeterEvent.findFirst.mockResolvedValue({
        createdAt: new Date("2026-09-22T09:55:00.000Z"),
      });
      reportUsage.mockRejectedValue(
        new Error("timeout after provider accepted"),
      );

      await expect(
        DeveloperUsageService.drainMeterEvents(now),
      ).resolves.toEqual({
        delivered: 0,
        retrying: 1,
        pending: 1,
        oldestPendingSeconds: 300,
      });
      expect(reportUsage).toHaveBeenCalledWith("cus_1", 1, "meter-event-1");
      expect(mockPrisma.developerMeterEvent.update).toHaveBeenCalledWith({
        where: { id: "meter-event-1" },
        data: {
          attempts: 1,
          nextAttemptAt: new Date("2026-09-22T10:02:00.000Z"),
          lastAttemptAt: now,
          failureCode: "provider_delivery_failed",
        },
      });
    });

    it("marks missing meter configuration explicitly and leaves the event pending", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([event()]);
      reportUsage.mockRejectedValue(
        new DeveloperBillingServiceError(
          "provider configuration unavailable",
          500,
          "missing_meter_configuration",
        ),
      );

      await DeveloperUsageService.drainMeterEvents(now);

      expect(mockPrisma.developerMeterEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureCode: "missing_meter_configuration",
          }),
        }),
      );
    });

    it("resolves a customer created after the call was queued", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([
        event({ stripeCustomerId: null }),
      ]);
      mockPrisma.developerSubscription.findMany.mockResolvedValue([
        { ownerUserId: "owner-1", stripeCustomerId: "cus_later" },
      ]);
      reportUsage.mockResolvedValue(undefined);

      await DeveloperUsageService.drainMeterEvents(now);

      expect(reportUsage).toHaveBeenCalledWith("cus_later", 1, "meter-event-1");
    });

    it("resolves one customer lookup for a batch from the same owner", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([
        event({ id: "meter-event-1", stripeCustomerId: null }),
        event({ id: "meter-event-2", stripeCustomerId: null }),
      ]);
      mockPrisma.developerSubscription.findMany.mockResolvedValue([
        { ownerUserId: "owner-1", stripeCustomerId: "cus_later" },
      ]);

      await DeveloperUsageService.drainMeterEvents(now);

      expect(mockPrisma.developerSubscription.findMany).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrisma.developerSubscription.findMany).toHaveBeenCalledWith({
        where: { ownerUserId: { in: ["owner-1"] } },
        select: { ownerUserId: true, stripeCustomerId: true },
      });
      expect(reportUsage).toHaveBeenCalledTimes(2);
    });

    it("keeps usage pending when no Stripe customer can be resolved", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([
        event({ stripeCustomerId: null, attempts: 2 }),
      ]);
      await DeveloperUsageService.drainMeterEvents(now);

      expect(reportUsage).not.toHaveBeenCalled();
      expect(mockPrisma.developerMeterEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attempts: 3,
            failureCode: "missing_stripe_customer",
          }),
        }),
      );
    });

    it("uses the same id after an ambiguous acknowledgement so Stripe can deduplicate", async () => {
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue([event()]);
      reportUsage
        .mockRejectedValueOnce(new Error("connection closed after send"))
        .mockResolvedValueOnce(undefined);

      await DeveloperUsageService.drainMeterEvents(now);
      await DeveloperUsageService.drainMeterEvents(
        new Date("2026-09-22T10:02:00.000Z"),
      );

      expect(reportUsage.mock.calls.map((call) => call[2])).toEqual([
        "meter-event-1",
        "meter-event-1",
      ]);
    });

    it("continues draining after a full batch while the job has time", async () => {
      jest.spyOn(Date, "now").mockReturnValue(0);
      const firstBatch = Array.from({ length: 100 }, (_, index) =>
        event({ id: `meter-event-${index + 1}` }),
      );
      mockPrisma.developerMeterEvent.findMany
        .mockResolvedValueOnce(firstBatch)
        .mockResolvedValueOnce([event({ id: "meter-event-101" })]);

      await expect(
        DeveloperUsageService.drainMeterEvents(now),
      ).resolves.toEqual({
        delivered: 101,
        retrying: 0,
        pending: 0,
        oldestPendingSeconds: null,
      });
      expect(mockPrisma.developerMeterEvent.findMany).toHaveBeenCalledTimes(2);
      expect(reportUsage).toHaveBeenCalledTimes(101);
    });

    it("stops between full batches when the drain budget is exhausted", async () => {
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(45_000);
      mockPrisma.developerMeterEvent.findMany.mockResolvedValue(
        Array.from({ length: 100 }, (_, index) =>
          event({ id: `meter-event-${index + 1}` }),
        ),
      );

      await DeveloperUsageService.drainMeterEvents(now);

      expect(mockPrisma.developerMeterEvent.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUsage", () => {
    it("returns free usage without a billing delivery state", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 77,
        meteredCallCount: 0,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "free",
      });

      await expect(
        DeveloperUsageService.getUsage("owner-1", "2026-09"),
      ).resolves.toEqual({
        billingPeriod: "2026-09",
        callCount: 77,
        limit: 1000,
        metering: null,
      });
    });

    it("keeps Enterprise uncapped without Stripe metering state", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 20_000,
        meteredCallCount: 0,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "enterprise",
      });

      await expect(
        DeveloperUsageService.getUsage("owner-1", "2026-09"),
      ).resolves.toEqual({
        billingPeriod: "2026-09",
        callCount: 20_000,
        limit: null,
        metering: null,
      });
    });

    it.each([
      [null, 0, "current"],
      [null, 2, "pending"],
      ["missing_meter_configuration", 2, "configuration_error"],
      ["provider_delivery_failed", 2, "delivery_error"],
    ])(
      "reconciles Pro usage with failure %s as %s",
      async (failureCodeValue, pending, status) => {
        const oldest = new Date("2026-09-22T09:00:00.000Z");
        mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
          callCount: 12,
          meteredCallCount: 10,
        });
        mockPrisma.developerSubscription.findUnique.mockResolvedValue({
          plan: "pro",
        });
        mockPrisma.developerMeterEvent.count
          .mockResolvedValueOnce(10 - pending)
          .mockResolvedValueOnce(pending);
        mockPrisma.developerMeterEvent.findFirst
          .mockResolvedValueOnce(pending ? { createdAt: oldest } : null)
          .mockResolvedValueOnce(
            failureCodeValue ? { failureCode: failureCodeValue } : null,
          );

        const result = await DeveloperUsageService.getUsage(
          "owner-1",
          "2026-09",
        );

        expect(result).toEqual({
          billingPeriod: "2026-09",
          callCount: 12,
          limit: null,
          metering: {
            recorded: 10,
            reported: 10 - pending,
            pending,
            status,
            failureCode: failureCodeValue,
            oldestPendingAt: pending ? oldest : null,
          },
        });
      },
    );

    it("shows an actionable mismatch when recorded and delivery counts diverge", async () => {
      mockPrisma.developerApiUsage.findUnique.mockResolvedValue({
        callCount: 12,
        meteredCallCount: 10,
      });
      mockPrisma.developerSubscription.findUnique.mockResolvedValue({
        plan: "pro",
      });
      mockPrisma.developerMeterEvent.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);

      const result = await DeveloperUsageService.getUsage("owner-1", "2026-09");

      expect(result.metering).toEqual(
        expect.objectContaining({
          status: "reconciliation_error",
          failureCode: "usage_count_mismatch",
          pending: 3,
        }),
      );
    });
  });
});
