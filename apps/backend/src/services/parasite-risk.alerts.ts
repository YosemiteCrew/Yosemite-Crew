import type { Prisma } from "@prisma/client";
import {
  isMoreSevereTier,
  isTierAtLeast,
  type ParasiteId,
  type ParasiteRiskCellReading,
  type ParasiteRiskReading,
  type RiskTier,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { NotificationService } from "./notification.service";
import { refreshCell } from "./parasite-risk.service";
import { PARASITE_ALERT_LABELS } from "src/utils/parasiteLabels";

/**
 * Daily refresh of every followed location, and the alerts that come out of it.
 *
 * The rule is deliberately conservative: alert only when a parasite crosses
 * *upward* into a tier the parent has not already been told about. A sustained
 * Extreme summer should produce one notification, not ninety.
 */

type AlertedTiers = Partial<Record<ParasiteId, RiskTier>>;

const parseAlertedTiers = (value: Prisma.JsonValue | null): AlertedTiers =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as AlertedTiers)
    : {};

/**
 * Decide which readings warrant a notification, and what the new alert state is.
 *
 * Exported for tests: this is the part worth pinning down, and it is pure.
 */
export function resolveAlerts(
  readings: readonly ParasiteRiskReading[],
  alertTier: RiskTier,
  previous: AlertedTiers,
): { alerts: ParasiteRiskReading[]; nextState: AlertedTiers } {
  const alerts: ParasiteRiskReading[] = [];
  const nextState: AlertedTiers = {};

  for (const reading of readings) {
    // Below the parent's threshold we forget the parasite entirely, so that a
    // later rise back through the threshold alerts again.
    if (!isTierAtLeast(reading.tier, alertTier)) continue;

    nextState[reading.parasiteId] = reading.tier;

    const lastAlerted = previous[reading.parasiteId];
    if (!lastAlerted || isMoreSevereTier(reading.tier, lastAlerted)) {
      alerts.push(reading);
    }
  }

  return { alerts, nextState };
}

const buildAlertBody = (
  label: string,
  alerts: readonly ParasiteRiskReading[],
): string => {
  const names = alerts.map(
    (alert) => PARASITE_ALERT_LABELS[alert.parasiteId] ?? alert.parasiteId,
  );

  const highest = alerts[0];
  const tierWord = highest.tier.toLowerCase();

  if (names.length === 1) {
    return `Modelled ${names[0]} risk in ${label} is now ${tierWord}. Check that preventative cover is up to date.`;
  }

  return `Modelled risk in ${label} is now ${tierWord} for ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}. Check that preventative cover is up to date.`;
};

interface SubscriptionRow {
  id: string;
  parentId: string;
  latBucket: number;
  lonBucket: number;
  countryCode: string;
  label: string;
  alertTier: string;
  alertedTiers: Prisma.JsonValue | null;
}

const cellKey = (row: SubscriptionRow): string =>
  `${row.latBucket}:${row.lonBucket}:${row.countryCode}`;

/** One entry per grid cell, holding every subscription that follows it. */
const groupByCell = (
  rows: readonly SubscriptionRow[],
): Map<string, SubscriptionRow[]> => {
  const byCell = new Map<string, SubscriptionRow[]>();

  for (const row of rows) {
    const key = cellKey(row);
    const existing = byCell.get(key);

    if (existing) {
      existing.push(row);
    } else {
      byCell.set(key, [row]);
    }
  }

  return byCell;
};

/** Returns true only when a push was actually dispatched. */
async function notifyParent(
  parentId: string,
  label: string,
  alerts: readonly ParasiteRiskReading[],
): Promise<boolean> {
  const parent = await prisma.parent.findUnique({
    where: { id: parentId },
    select: { linkedUserId: true },
  });

  if (!parent?.linkedUserId) return false;

  await NotificationService.sendToUser(parent.linkedUserId, {
    title: "Parasite risk has risen near you",
    body: buildAlertBody(label, alerts),
    type: "REMINDERS",
  });

  return true;
}

export interface RefreshSummary {
  cellsRefreshed: number;
  cellsFailed: number;
  alertsSent: number;
}

/** Refresh the cell these rows share, or null when the weather fetch failed. */
async function refreshCellForFollowers(
  rows: readonly SubscriptionRow[],
): Promise<ParasiteRiskCellReading | null> {
  const [first] = rows;

  try {
    return await refreshCell(
      first.latBucket,
      first.lonBucket,
      first.countryCode,
    );
  } catch (error) {
    // One unreachable cell must not stop the rest of the sweep.
    logger.error("Failed to refresh parasite risk cell", {
      error,
      lat: first.latBucket,
      lon: first.lonBucket,
    });
    return null;
  }
}

/**
 * Apply the alert rule to one subscription and record its new alert state.
 *
 * Returns true only when a push was actually dispatched.
 */
async function processSubscription(
  row: SubscriptionRow,
  reading: ParasiteRiskCellReading,
): Promise<boolean> {
  const { alerts, nextState } = resolveAlerts(
    reading.readings,
    row.alertTier as RiskTier,
    parseAlertedTiers(row.alertedTiers),
  );

  await prisma.parasiteRiskSubscription.update({
    where: { id: row.id },
    data: { alertedTiers: nextState as Prisma.InputJsonValue },
  });

  if (alerts.length === 0) return false;

  try {
    return await notifyParent(row.parentId, row.label, alerts);
  } catch (error) {
    logger.error("Failed to send parasite risk alert", {
      error,
      subscriptionId: row.id,
    });
    return false;
  }
}

/**
 * Refresh every followed cell once, then alert the parents who follow it.
 *
 * Cells are deduplicated first so that a hundred users in the same city cost
 * one weather request.
 */
export async function refreshFollowedCells(): Promise<RefreshSummary> {
  const subscriptions: SubscriptionRow[] =
    await prisma.parasiteRiskSubscription.findMany({
      select: {
        id: true,
        parentId: true,
        latBucket: true,
        lonBucket: true,
        countryCode: true,
        label: true,
        alertTier: true,
        alertedTiers: true,
      },
    });

  const summary: RefreshSummary = {
    cellsRefreshed: 0,
    cellsFailed: 0,
    alertsSent: 0,
  };

  for (const rows of groupByCell(subscriptions).values()) {
    const reading = await refreshCellForFollowers(rows);

    if (reading === null) {
      summary.cellsFailed += 1;
      continue;
    }

    summary.cellsRefreshed += 1;

    for (const row of rows) {
      if (await processSubscription(row, reading)) {
        summary.alertsSent += 1;
      }
    }
  }

  logger.info("Parasite risk refresh complete", { ...summary });
  return summary;
}
