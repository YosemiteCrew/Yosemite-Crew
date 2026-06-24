import {
  FinanceEventService,
  resolveActorDisplayName,
} from "../../src/services/finance/events";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    financeEvent: {
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe("FinanceEventService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records finance events with provider-neutral payloads", async () => {
    (prisma.financeEvent.create as jest.Mock).mockResolvedValueOnce({
      id: "evt_1",
    });

    await FinanceEventService.recordEvent({
      organisationId: "org_1",
      eventType: "INVOICE_CREATED",
      entityType: "INVOICE",
      entityId: "inv_1",
      payload: {
        totalAmount: 120,
        currency: "usd",
      },
    });

    expect(prisma.financeEvent.create).toHaveBeenCalledWith({
      data: {
        organisationId: "org_1",
        eventType: "INVOICE_CREATED",
        entityType: "INVOICE",
        entityId: "inv_1",
        payload: {
          totalAmount: 120,
          currency: "usd",
        },
        occurredAt: new Date("2026-06-18T00:00:00.000Z"),
        processedAt: undefined,
      },
    });
  });

  describe("resolveActorDisplayName", () => {
    it("returns null when no user id is provided", async () => {
      expect(await resolveActorDisplayName(undefined)).toBeNull();
      expect(await resolveActorDisplayName("   ")).toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns null when the user is not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      expect(await resolveActorDisplayName("user-1")).toBeNull();
    });

    it("joins first and last name, falling back to email", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        firstName: "Harshit",
        lastName: "Wandhare",
        email: "h@example.com",
      });
      expect(await resolveActorDisplayName("user-1")).toBe("Harshit Wandhare");

      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        firstName: null,
        lastName: null,
        email: "h@example.com",
      });
      expect(await resolveActorDisplayName("user-2")).toBe("h@example.com");
    });
  });

  it("records a readiness event with the resolved actor name in the payload", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
      firstName: "Harshit",
      lastName: "Wandhare",
      email: "h@example.com",
    });
    (prisma.financeEvent.create as jest.Mock).mockResolvedValueOnce({
      id: "evt_2",
    });

    await FinanceEventService.recordReadinessEvent({
      organisationId: "org_1",
      eventType: "INVOICE_READY_FOR_BILLING",
      entityType: "INVOICE",
      entityId: "inv_1",
      actorUserId: "user-1",
    });

    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "INVOICE_READY_FOR_BILLING",
          entityType: "INVOICE",
          entityId: "inv_1",
          payload: { actorUserId: "user-1", actorName: "Harshit Wandhare" },
        }),
      }),
    );
  });
});
