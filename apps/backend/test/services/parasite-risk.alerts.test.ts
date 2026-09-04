import type { ParasiteRiskReading } from "@yosemite-crew/types";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parasiteRiskSubscription: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    parent: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/parasite-risk.service", () => ({
  cleanupCachedCells: jest.fn(),
  refreshCell: jest.fn(),
}));

jest.mock("../../src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: jest.fn(),
  },
}));

import { prisma } from "src/config/prisma";
import {
  refreshFollowedCells,
  resolveAlerts,
} from "../../src/services/parasite-risk.alerts";
import { NotificationService } from "../../src/services/notification.service";
import {
  cleanupCachedCells,
  refreshCell,
} from "../../src/services/parasite-risk.service";

const reading = (
  parasiteId: string,
  tier: ParasiteRiskReading["tier"],
  index = 60,
): ParasiteRiskReading => ({
  parasiteId: parasiteId as ParasiteRiskReading["parasiteId"],
  group: "TICK",
  index,
  tier,
  trend: "STEADY",
});

describe("resolveAlerts", () => {
  it("alerts the first time a parasite reaches the threshold", () => {
    const { alerts, nextState } = resolveAlerts(
      [reading("paralysis_tick", "HIGH")],
      "HIGH",
      {},
    );

    expect(alerts.map((a) => a.parasiteId)).toEqual(["paralysis_tick"]);
    expect(nextState).toEqual({ paralysis_tick: "HIGH" });
  });

  it("does not re-alert while the tier is unchanged", () => {
    const { alerts } = resolveAlerts(
      [reading("paralysis_tick", "HIGH")],
      "HIGH",
      {
        paralysis_tick: "HIGH",
      },
    );

    expect(alerts).toHaveLength(0);
  });

  it("alerts again when the tier escalates", () => {
    const { alerts, nextState } = resolveAlerts(
      [reading("paralysis_tick", "EXTREME")],
      "HIGH",
      { paralysis_tick: "HIGH" },
    );

    expect(alerts).toHaveLength(1);
    expect(nextState.paralysis_tick).toBe("EXTREME");
  });

  it("does not alert when the tier falls back", () => {
    const { alerts, nextState } = resolveAlerts(
      [reading("paralysis_tick", "HIGH")],
      "HIGH",
      { paralysis_tick: "EXTREME" },
    );

    expect(alerts).toHaveLength(0);
    expect(nextState.paralysis_tick).toBe("EXTREME");
  });

  it("ignores parasites below the parent's threshold and forgets their state", () => {
    const { alerts, nextState } = resolveAlerts(
      [reading("flea", "MODERATE")],
      "HIGH",
      { flea: "HIGH" },
    );

    expect(alerts).toHaveLength(0);
    // Cleared, so a later rise back through the threshold alerts again.
    expect(nextState.flea).toBeUndefined();
  });

  it("re-alerts after dropping below the threshold and rising again", () => {
    const dropped = resolveAlerts([reading("flea", "LOW")], "HIGH", {
      flea: "EXTREME",
    });
    const risen = resolveAlerts(
      [reading("flea", "HIGH")],
      "HIGH",
      dropped.nextState,
    );

    expect(risen.alerts).toHaveLength(1);
  });

  it("respects a parent who only wants extreme alerts", () => {
    const { alerts } = resolveAlerts([reading("flea", "HIGH")], "EXTREME", {});
    expect(alerts).toHaveLength(0);
  });
});

describe("refreshFollowedCells", () => {
  const subscription = {
    id: "sub-1",
    parentId: "parent-1",
    latBucket: -27.375,
    lonBucket: 153.125,
    countryCode: "AU",
    label: "Brisbane",
    alertTier: "HIGH",
    alertedTiers: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Resolve whoever the batch asks for, which is what the old per-row
    // findUnique mock did implicitly.
    (prisma.parent.findMany as jest.Mock).mockImplementation(
      ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.map((id) => ({ id, linkedUserId: `user-${id}` })),
        ),
    );
    (prisma.parasiteRiskSubscription.updateMany as jest.Mock).mockResolvedValue(
      {
        count: 1,
      },
    );
    (NotificationService.sendToUser as jest.Mock).mockResolvedValue([
      { token: "device-1", success: true },
    ]);
  });

  it("addresses the push to the parent, which is what device tokens are keyed by", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });

    await refreshFollowedCells();

    expect(cleanupCachedCells).toHaveBeenCalledTimes(1);
    // The mobile client registers its token under Parent.id, so sending to the
    // linked auth user id resolves no tokens and delivers nothing.
    expect(NotificationService.sendToUser).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({ type: "REMINDERS" }),
    );
  });

  it("refreshes each cell once even when many parents follow it", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
      { ...subscription, id: "sub-2", parentId: "parent-2" },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });

    const summary = await refreshFollowedCells();

    expect(refreshCell).toHaveBeenCalledTimes(1);
    expect(summary.cellsRefreshed).toBe(1);
    expect(summary.alertsSent).toBe(2);
  });

  it("sends no push when nothing crossed a threshold", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      { ...subscription, alertedTiers: { paralysis_tick: "HIGH" } },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });

    const summary = await refreshFollowedCells();

    expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    expect(summary.alertsSent).toBe(0);
  });

  it("keeps sweeping when a subscription is deleted before bookkeeping", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      { ...subscription, alertedTiers: { paralysis_tick: "HIGH" } },
      {
        ...subscription,
        id: "sub-2",
        alertedTiers: { paralysis_tick: "HIGH" },
      },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });
    (prisma.parasiteRiskSubscription.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(refreshFollowedCells()).resolves.toEqual({
      cellsRefreshed: 1,
      cellsFailed: 0,
      alertsSent: 0,
    });
    expect(prisma.parasiteRiskSubscription.updateMany).toHaveBeenCalledTimes(2);
  });

  it("does not mark tiers alerted when the push fails, so it retries next run", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });
    (NotificationService.sendToUser as jest.Mock).mockRejectedValueOnce(
      new Error("push gateway down"),
    );

    const summary = await refreshFollowedCells();

    expect(summary.alertsSent).toBe(0);
    // Recording the tier before a confirmed send would suppress this crossing
    // forever; the row must be left untouched so the next sweep tries again.
    expect(prisma.parasiteRiskSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("records the alerted tier once the push succeeds", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });

    const summary = await refreshFollowedCells();

    expect(summary.alertsSent).toBe(1);
    expect(prisma.parasiteRiskSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: { alertedTiers: { paralysis_tick: "HIGH" } },
      }),
    );
  });

  it("looks each parent up once, however many locations they follow", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
      { ...subscription, id: "sub-2", latBucket: 41.875, lonBucket: 12.375 },
      { ...subscription, id: "sub-3", latBucket: 51.5, lonBucket: -0.125 },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });

    await refreshFollowedCells();

    // One batched read for the whole sweep, not one per subscription.
    expect(prisma.parent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.parent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["parent-1"] } } }),
    );
  });

  it("keeps sweeping when one cell fails to refresh", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
      { ...subscription, id: "sub-3", latBucket: 41.875, lonBucket: 12.375 },
    ]);
    (refreshCell as jest.Mock)
      .mockRejectedValueOnce(new Error("weather provider down"))
      .mockResolvedValueOnce({ readings: [reading("flea", "EXTREME")] });

    const summary = await refreshFollowedCells();

    expect(summary.cellsFailed).toBe(1);
    expect(summary.cellsRefreshed).toBe(1);
    expect(summary.alertsSent).toBe(1);
  });

  it("skips parents with no linked auth user rather than throwing", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (prisma.parent.findMany as jest.Mock).mockResolvedValue([
      { id: "parent-1", linkedUserId: null },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "EXTREME")],
    });

    const summary = await refreshFollowedCells();

    expect(NotificationService.sendToUser).not.toHaveBeenCalled();
    // Not counted as sent, because nothing was delivered.
    expect(summary.alertsSent).toBe(0);
  });

  it("names the location in the alert body", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "EXTREME")],
    });

    await refreshFollowedCells();

    const [, payload] = (NotificationService.sendToUser as jest.Mock).mock
      .calls[0];
    expect(payload.body).toContain("Brisbane");
    expect(payload.body).toContain("paralysis tick");
    expect(payload.type).toBe("REMINDERS");
  });

  it("lists every crossed parasite under its own tier", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [
        reading("paralysis_tick", "EXTREME"),
        reading("flea", "HIGH"),
        reading("heartworm", "HIGH"),
      ],
    });

    const summary = await refreshFollowedCells();

    const [, payload] = (NotificationService.sendToUser as jest.Mock).mock
      .calls[0];
    // The tick is extreme and the other two are not; the copy must not promote
    // them to the leading parasite's tier.
    expect(payload.body).toBe(
      "Modelled risk in Brisbane is now extreme for paralysis tick, and high for flea and heartworm. Check that preventative cover is up to date.",
    );
    // One push for the cell, not one per parasite.
    expect(summary.alertsSent).toBe(1);
  });

  it("states a shared tier once when every parasite crossed together", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("flea", "HIGH"), reading("heartworm", "HIGH")],
    });

    await refreshFollowedCells();

    const [, payload] = (NotificationService.sendToUser as jest.Mock).mock
      .calls[0];
    expect(payload.body).toBe(
      "Modelled risk in Brisbane is now high for flea and heartworm. Check that preventative cover is up to date.",
    );
  });

  it("does not record the tier when the send reached no device", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "HIGH")],
    });
    // sendToUser resolves an empty array when the parent has no registered
    // device, and success:false entries when every send is rejected.
    (NotificationService.sendToUser as jest.Mock).mockResolvedValueOnce([]);

    const summary = await refreshFollowedCells();

    expect(summary.alertsSent).toBe(0);
    expect(prisma.parasiteRiskSubscription.updateMany).not.toHaveBeenCalled();
  });

  it("keeps sweeping when a push fails", async () => {
    (prisma.parasiteRiskSubscription.findMany as jest.Mock).mockResolvedValue([
      subscription,
      { ...subscription, id: "sub-4", parentId: "parent-4" },
    ]);
    (refreshCell as jest.Mock).mockResolvedValue({
      readings: [reading("paralysis_tick", "EXTREME")],
    });
    (NotificationService.sendToUser as jest.Mock)
      .mockRejectedValueOnce(new Error("push service down"))
      .mockResolvedValueOnce([{ token: "device-1", success: true }]);

    const summary = await refreshFollowedCells();

    expect(NotificationService.sendToUser).toHaveBeenCalledTimes(2);
    expect(summary.alertsSent).toBe(1);
  });
});
