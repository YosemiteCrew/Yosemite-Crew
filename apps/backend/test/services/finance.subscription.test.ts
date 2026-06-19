import { FinanceSubscriptionService } from "../../src/services/finance/subscription";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    subscriptionEntitlement: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    financeProviderLink: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    usageSnapshot: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    usageEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    financeEvent: {
      create: jest.fn(),
    },
    organizationUsageCounter: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    userOrganization: {
      count: jest.fn(),
    },
  },
}));

describe("FinanceSubscriptionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-18T00:00:00.000Z"));
    process.env.STRIPE_PRICE_BUSINESS_MONTH = "price_month_mock";
    process.env.STRIPE_PRICE_BUSINESS_YEAR = "price_year_mock";
    (prisma.usageEvent.create as jest.Mock).mockResolvedValue({
      id: "usage_evt_default",
      quantity: 0,
      billableQuantity: 0,
      occurredAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValue({
      id: "usage_snapshot_default",
      snapshotType: "snapshot",
      seatsActive: 0,
      seatsBillable: 0,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("records seat usage and usage counters", async () => {
    (prisma.usageEvent.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_evt_1",
      quantity: 4,
      billableQuantity: 4,
      occurredAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_snapshot_1",
      snapshotType: "SEAT_SYNC",
      seatsActive: 4,
      seatsBillable: 4,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordSeatUsage({
      orgId: "org_1",
      seats: 4,
    });

    expect(prisma.usageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        usageKey: "SEATS_ACTIVE",
        quantity: 4,
        billableQuantity: 4,
        source: "SUBSCRIPTION",
      }),
    });
    expect(prisma.organizationUsageCounter.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        usersActiveCount: 4,
        usersBillableCount: 4,
      },
      update: { usersActiveCount: 4, usersBillableCount: 4 },
    });
    expect(prisma.usageSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        snapshotType: "SEAT_SYNC",
        seatsActive: 4,
        seatsBillable: 4,
      }),
    });
  });

  it("returns the current subscription summary", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      {
        provider: "STRIPE",
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
        externalSubscriptionItemId: "item_1",
        externalPriceId: "price_1",
        externalProductId: "prod_1",
        metadata: {},
        createdAt: new Date("2026-06-17T00:00:00.000Z"),
        updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);
    (
      prisma.subscriptionEntitlement.findMany as jest.Mock
    ).mockResolvedValueOnce([
      {
        id: "ent_1",
        code: "BUSINESS_PLAN",
        name: "Business subscription",
        value: {},
        source: "STRIPE",
        status: "ACTIVE",
        grantedAt: new Date("2026-06-18T00:00:00.000Z"),
        expiresAt: null,
        metadata: {},
        createdAt: new Date("2026-06-18T00:00:00.000Z"),
        updatedAt: new Date("2026-06-18T00:00:00.000Z"),
      },
    ]);
    (
      prisma.organizationUsageCounter.findUnique as jest.Mock
    ).mockResolvedValueOnce(null);
    (prisma.usageSnapshot.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.usageEvent.findMany as jest.Mock).mockResolvedValueOnce([]);

    const result =
      await FinanceSubscriptionService.getCurrentSubscription("org_1");

    expect(result.organisationId).toBe("org_1");
    expect(result.providerLink?.provider).toBe("STRIPE");
    expect(result.entitlement?.code).toBe("BUSINESS_PLAN");
  });

  it("upserts a subscription and records a finance event", async () => {
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({
      provider: "STRIPE",
      externalSubscriptionId: "sub_1",
    });
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce({
      code: "BUSINESS_PLAN",
    });
    (prisma.financeEvent.create as jest.Mock).mockResolvedValueOnce({});

    const result = await FinanceSubscriptionService.upsertSubscription({
      orgId: "org_1",
      planCode: "business",
      provider: "stripe",
      providerSubscriptionId: "sub_1",
      quantity: 3,
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId_provider: {
            orgId: "org_1",
            provider: "STRIPE",
          },
        },
      }),
    );
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId_code: {
            orgId: "org_1",
            code: "BUSINESS_PLAN",
          },
        },
      }),
    );
    expect(prisma.financeEvent.create).toHaveBeenCalled();
    expect(result.organisationId).toBe("org_1");
  });

  it("lists usage snapshots with metadata filters", async () => {
    (prisma.usageSnapshot.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "snap_1",
        orgId: "org_1",
        snapshotType: "SEAT_SYNC",
        snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
        metadata: {
          subscriptionId: "sub_1",
          featureKey: "appointments",
        },
      },
      {
        id: "snap_2",
        orgId: "org_1",
        snapshotType: "OTHER",
        snapshotAt: new Date("2026-06-17T00:00:00.000Z"),
        metadata: {
          subscriptionId: "sub_2",
          featureKey: "tools",
        },
      },
    ]);

    const snapshots = await FinanceSubscriptionService.listUsageSnapshots(
      "org_1",
      { subscriptionId: "sub_1", featureKey: "appointments" },
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.id).toBe("snap_1");
  });

  it("prepares business checkout context and records seat usage", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });
    (prisma.financeProviderLink.findUnique as jest.Mock).mockResolvedValueOnce({
      externalCustomerId: "cus_1",
    });
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(3);
    (prisma.organizationUsageCounter.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    const context =
      await FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      );

    expect(context).toEqual({
      orgName: "Clinic One",
      connectAccountId: "acct_1",
      externalCustomerId: "cus_1",
      priceId: "price_month_mock",
      seats: 3,
    });
    expect(prisma.userOrganization.count).toHaveBeenCalledWith({
      where: {
        organizationReference: "org_1",
        active: true,
      },
    });
    expect(prisma.financeProviderLink.findUnique).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      select: {
        externalCustomerId: true,
      },
    });
    expect(prisma.organizationUsageCounter.upsert).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      create: {
        orgId: "org_1",
        usersActiveCount: 3,
        usersBillableCount: 3,
      },
      update: { usersActiveCount: 3, usersBillableCount: 3 },
    });
  });

  it("records the stripe customer id for business checkout", async () => {
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});

    await FinanceSubscriptionService.recordBusinessCheckoutCustomer({
      orgId: "org_1",
      externalCustomerId: "cus_1",
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: {
        orgId: "org_1",
        provider: "STRIPE",
        externalCustomerId: "cus_1",
        externalSubscriptionId: undefined,
        externalSubscriptionItemId: undefined,
        externalPriceId: undefined,
        externalProductId: undefined,
        metadata: { source: "business_checkout" },
      },
      update: {
        externalCustomerId: "cus_1",
        externalSubscriptionId: undefined,
        externalSubscriptionItemId: undefined,
        externalPriceId: undefined,
        externalProductId: undefined,
        metadata: { source: "business_checkout" },
      },
    });
  });

  it("resolves the stripe customer id for customer portal sessions", async () => {
    (prisma.financeProviderLink.findUnique as jest.Mock).mockResolvedValueOnce({
      externalCustomerId: "cus_1",
    });

    await expect(
      FinanceSubscriptionService.resolveBillingCustomerId("org_1"),
    ).resolves.toEqual({
      externalCustomerId: "cus_1",
    });

    expect(prisma.financeProviderLink.findUnique).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      select: {
        externalCustomerId: true,
      },
    });
  });

  it("throws when organisation is missing", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("Organisation not found");
  });

  it("throws when business pricing env vars are missing", async () => {
    delete process.env.STRIPE_PRICE_BUSINESS_MONTH;

    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("Missing STRIPE_PRICE_BUSINESS_* env vars");
  });

  it("throws when there are no active users", async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
      name: "Clinic One",
      stripeAccountId: "acct_1",
    });
    (prisma.financeProviderLink.findUnique as jest.Mock).mockResolvedValueOnce(
      null,
    );
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(0);

    await expect(
      FinanceSubscriptionService.prepareBusinessCheckoutSession(
        "org_1",
        "month",
      ),
    ).rejects.toThrow("No users found. Add at least 1 user to start Business.");
  });

  it("resolves a seat sync plan only when business subscription is active", async () => {
    (prisma.financeProviderLink.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        externalSubscriptionItemId: null,
        metadata: {
          subscriptionStatus: "none",
          seatQuantity: 0,
        },
      })
      .mockResolvedValueOnce({
        externalSubscriptionItemId: "item_1",
        metadata: {
          subscriptionStatus: "active",
          seatQuantity: 2,
        },
      });
    (prisma.userOrganization.count as jest.Mock).mockResolvedValueOnce(5);

    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toBeNull();
    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toBeNull();
    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toEqual({
      subscriptionItemId: "item_1",
      oldSeats: 2,
      newSeats: 5,
      prorationBehavior: "create_prorations",
    });
  });

  it("records business checkout completion", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordBusinessCheckoutCompleted({
      customerId: "cus_1",
      subscriptionId: "sub_1",
      subscriptionItemId: "item_1",
      priceId: "price_1",
      productId: "prod_1",
      billingInterval: "month",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      seatQuantity: 2,
      currentPeriodStart: new Date("2026-06-17T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-17T00:00:00.000Z"),
      livemode: false,
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
        externalSubscriptionItemId: "item_1",
        externalPriceId: "price_1",
        externalProductId: "prod_1",
      }),
      update: expect.objectContaining({
        externalCustomerId: "cus_1",
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "ACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "ACTIVE",
      }),
    });
  });

  it("normalizes stripe subscription checkout completion into finance writes", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted({
      customerId: "cus_1",
      session: {
        livemode: false,
      } as any,
      subscription: {
        id: "sub_1",
        status: "active",
        cancel_at_period_end: false,
        items: {
          data: [
            {
              id: "item_1",
              quantity: 2,
              current_period_start: 1718668800,
              current_period_end: 1721260800,
              price: {
                id: "price_1",
                recurring: { interval: "month" },
                product: "prod_1",
              },
            },
          ],
        },
      } as any,
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalled();
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalled();
  });

  it("records subscription updates and omits absent timestamps", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1", metadata: null },
    ]);
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordSubscriptionUpdated({
      subscriptionId: "sub_1",
      subscriptionStatus: "past_due",
      cancelAtPeriodEnd: false,
      seatQuantity: 6,
      currentPeriodStart: new Date("2026-06-18T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-07-18T00:00:00.000Z"),
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalSubscriptionId: "sub_1",
      }),
      update: expect.objectContaining({
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "ACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "ACTIVE",
      }),
    });
  });

  it("normalizes stripe subscription updates into finance writes", async () => {
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );

    await FinanceSubscriptionService.recordStripeSubscriptionUpdated({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      canceled_at: null,
      items: {
        data: [
          {
            quantity: 6,
            current_period_start: 1718668800,
            current_period_end: 1721260800,
          },
        ],
      },
    } as any);
  });

  it("records subscription lifecycle changes", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValueOnce([
      { orgId: "org_1" },
    ]);
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValueOnce({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValueOnce(
      {},
    );
    (prisma.usageSnapshot.create as jest.Mock).mockResolvedValueOnce({
      id: "usage_snapshot_2",
      snapshotType: "SUBSCRIPTION_TERMINATED",
      seatsActive: 0,
      seatsBillable: 0,
      appointmentsUsed: 0,
      toolsUsed: 0,
      snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
    });

    await FinanceSubscriptionService.recordSubscriptionDeleted("sub_1");
    await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
      subscriptionId: "sub_1",
      invoiceId: "inv_1",
    });
    await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
      subscriptionId: "sub_1",
      invoiceId: "inv_2",
    });

    expect(prisma.financeProviderLink.upsert).toHaveBeenCalledWith({
      where: {
        orgId_provider: {
          orgId: "org_1",
          provider: "STRIPE",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        provider: "STRIPE",
        externalSubscriptionId: "sub_1",
      }),
      update: expect.objectContaining({
        externalSubscriptionId: "sub_1",
      }),
    });
    expect(prisma.subscriptionEntitlement.upsert).toHaveBeenCalledWith({
      where: {
        orgId_code: {
          orgId: "org_1",
          code: "BUSINESS_PLAN",
        },
      },
      create: expect.objectContaining({
        orgId: "org_1",
        code: "BUSINESS_PLAN",
        source: "STRIPE",
        status: "INACTIVE",
      }),
      update: expect.objectContaining({
        source: "STRIPE",
        status: "INACTIVE",
      }),
    });
    expect(prisma.usageSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: "org_1",
        snapshotType: "SUBSCRIPTION_TERMINATED",
      }),
    });
    expect(prisma.financeEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "SUBSCRIPTION_RENEWED",
          entityType: "SUBSCRIPTION",
          entityId: "sub_1",
        }),
      }),
    );
  });

  it("covers subscription status and interval mapping branches", async () => {
    (prisma.financeProviderLink.upsert as jest.Mock).mockResolvedValue({});
    (prisma.subscriptionEntitlement.upsert as jest.Mock).mockResolvedValue({});
    (prisma.financeProviderLink.findMany as jest.Mock).mockResolvedValue([
      { orgId: "org_1" },
    ]);

    for (const status of [
      "none",
      "trialing",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]) {
      await FinanceSubscriptionService.recordStripeSubscriptionUpdated({
        id: `sub_${status}`,
        status: status as any,
        cancel_at_period_end: false,
        canceled_at: null,
        items: {
          data: [
            {
              quantity: 1,
              current_period_start: 1718668800,
              current_period_end: 1721260800,
            },
          ],
        },
      } as any);
    }

    await FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted({
      customerId: "cus_1",
      session: { livemode: true } as any,
      subscription: {
        id: "sub_year",
        status: "active",
        cancel_at_period_end: true,
        items: {
          data: [
            {
              id: "item_year",
              quantity: 2,
              current_period_start: 1718668800,
              current_period_end: 1721260800,
              price: {
                id: "price_year",
                recurring: { interval: "year" },
                product: { id: "prod_year" },
              },
            },
          ],
        },
      } as any,
    });

    await FinanceSubscriptionService.recordStripeSubscriptionCheckoutCompleted({
      customerId: "cus_2",
      session: { livemode: false } as any,
      subscription: {
        id: "sub_missing",
        status: "active",
        cancel_at_period_end: false,
        items: { data: [] },
      } as any,
    });
  });

  it("covers usage lookup and seat sync branches", async () => {
    (prisma.financeProviderLink.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        externalCustomerId: null,
      })
      .mockResolvedValueOnce({
        externalSubscriptionItemId: "item_1",
        metadata: {
          subscriptionStatus: "active",
          seatQuantity: "not-a-number",
        },
      })
      .mockResolvedValueOnce({
        externalSubscriptionItemId: "item_1",
        metadata: {
          subscriptionStatus: "active",
          seatQuantity: 2,
        },
      });
    (prisma.userOrganization.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    (prisma.usageSnapshot.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "snap_1",
        orgId: "org_1",
        snapshotType: "snapshot",
        snapshotAt: new Date("2026-06-18T00:00:00.000Z"),
        metadata: null,
      },
    ]);

    await expect(
      FinanceSubscriptionService.resolveBillingCustomerId("org_1"),
    ).resolves.toEqual({ externalCustomerId: null });

    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toEqual({
      subscriptionItemId: "item_1",
      oldSeats: 0,
      newSeats: 2,
      prorationBehavior: "create_prorations",
    });

    await expect(
      FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan("org_1"),
    ).resolves.toBeNull();

    await expect(
      FinanceSubscriptionService.listUsageSnapshots("org_1"),
    ).resolves.toHaveLength(1);
  });

  it("covers subscription lifecycle branches with missing checkout data", async () => {
    (prisma.financeProviderLink.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
      subscriptionId: "sub_empty_paid",
      invoiceId: "inv_1",
    });

    await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
      subscriptionId: "sub_empty_failed",
      invoiceId: "inv_2",
    });
  });
});
