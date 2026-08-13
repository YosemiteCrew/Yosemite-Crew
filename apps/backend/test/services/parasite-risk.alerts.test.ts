import type { ParasiteRiskReading } from "@yosemite-crew/types";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parasiteRiskSubscription: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/parasite-risk.service", () => ({
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
import { refreshCell } from "../../src/services/parasite-risk.service";

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
    expect(nextState.paralysis_tick).toBe("HIGH");
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
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      linkedUserId: "user-1",
    });
    (prisma.parasiteRiskSubscription.update as jest.Mock).mockResolvedValue({});
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
    (prisma.parent.findUnique as jest.Mock).mockResolvedValue({
      linkedUserId: null,
    });
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

  it("lists every crossed parasite in one alert body", async () => {
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
    expect(payload.body).toContain("paralysis tick, flea and heartworm");
    // One push for the cell, not one per parasite.
    expect(summary.alertsSent).toBe(1);
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
      .mockResolvedValueOnce(undefined);

    const summary = await refreshFollowedCells();

    expect(NotificationService.sendToUser).toHaveBeenCalledTimes(2);
    expect(summary.alertsSent).toBe(1);
  });
});
