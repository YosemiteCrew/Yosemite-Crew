import { FinanceEventService } from "../../src/services/finance/events";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    financeEvent: {
      create: jest.fn(),
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
});
