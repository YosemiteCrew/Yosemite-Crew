import { Prisma } from "@prisma/client";
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
import { cleanupCachedCells, refreshCell } from "./parasite-risk.service";
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
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

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

    const lastAlerted = previous[reading.parasiteId];
    nextState[reading.parasiteId] =
      lastAlerted && isMoreSevereTier(lastAlerted, reading.tier)
        ? lastAlerted
        : reading.tier;
    if (!lastAlerted || isMoreSevereTier(reading.tier, lastAlerted)) {
      alerts.push(reading);
    }
  }

  return { alerts, nextState };
}

const parasiteName = (alert: ParasiteRiskReading): string =>
  PARASITE_ALERT_LABELS[alert.parasiteId] ?? alert.parasiteId;

const joinWithAnd = (parts: readonly string[], separator: string): string =>
  parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")}${separator}${parts[parts.length - 1]}`;

const buildAlertBody = (
  label: string,
  alerts: readonly ParasiteRiskReading[],
): string => {
  if (alerts.length === 1) {
    const [only] = alerts;
    return `Modelled ${parasiteName(only)} risk in ${label} is now ${only.tier.toLowerCase()}. Check that preventative cover is up to date.`;
  }

  // One clause per tier: naming a single tier for the whole list would tell a
  // parent their high-risk flea is extreme whenever a tick leads the list.
  const byTier = new Map<RiskTier, string[]>();

  for (const alert of alerts) {
    const named = byTier.get(alert.tier);

    if (named) {
      named.push(parasiteName(alert));
    } else {
      byTier.set(alert.tier, [parasiteName(alert)]);
    }
  }

  // `alerts` arrives most severe first, so the clauses do too.
  const clauses = [...byTier].map(
    ([tier, names]) =>
      `${tier.toLowerCase()} for ${joinWithAnd(names, " and ")}`,
  );

  return `Modelled risk in ${label} is now ${joinWithAnd(clauses, ", and ")}. Check that preventative cover is up to date.`;
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

/**
 * The parents reachable by push, resolved in one query for the whole sweep.
 *
 * A parent following several locations appears once per subscription, so a
 * per-subscription lookup re-reads the same row repeatedly across a sweep. A
 * parent with no linked mobile user has no device token to send to, so those
 * are dropped here rather than costing a token lookup per subscription.
 */
async function loadNotifiableParentIds(
  rows: readonly SubscriptionRow[],
): Promise<Set<string>> {
  const parentIds = [...new Set(rows.map((row) => row.parentId))];
  const parents = await prisma.parent.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, linkedUserId: true },
  });

  return new Set(
    parents.filter((parent) => parent.linkedUserId).map((parent) => parent.id),
  );
}

/** Returns true only when a push reached at least one device. */
async function notifyParent(
  parentId: string,
  label: string,
  alerts: readonly ParasiteRiskReading[],
): Promise<boolean> {
  // Device tokens are keyed by the parent id the mobile client registers, not
  // by the auth user behind it, so the push has to be addressed to the parent.
  const results = await NotificationService.sendToUser(parentId, {
    title: "Parasite risk has risen near you",
    body: buildAlertBody(label, alerts),
    type: "REMINDERS",
  });

  // An empty result means the parent has no registered device; all-false means
  // every send was rejected. Neither is a delivered alert.
  return results.some((result) => result.success);
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
 * Returns true only when a push reached at least one device.
 */
async function processSubscription(
  row: SubscriptionRow,
  reading: ParasiteRiskCellReading,
  notifiableParentIds: ReadonlySet<string>,
): Promise<boolean> {
  const { alerts, nextState } = resolveAlerts(
    reading.readings,
    row.alertTier as RiskTier,
    parseAlertedTiers(row.alertedTiers),
  );

  const persistAlertedTiers = async () => {
    await prisma.$executeRaw`
      UPDATE "ParasiteRiskSubscription"
      SET "alertedTiers" = ${JSON.stringify(nextState)}::jsonb,
          "updatedAt" = NOW()
      WHERE "id" = ${String(row.id)}
    `;
  };

  // Nothing to send: persist the bookkeeping on its own, which is what forgets
  // parasites that fell back below the parent's threshold.
  if (alerts.length === 0) {
    await persistAlertedTiers();
    return false;
  }

  if (!notifiableParentIds.has(row.parentId)) return false;

  // Notify BEFORE recording the tiers as alerted. Recording first means a failed
  // send still marks the crossing as delivered, so that threshold would never
  // notify again. nextState is rebuilt from the current readings on every run, so
  // skipping the write here costs nothing but a retry next cycle.
  let notified = false;
  try {
    notified = await notifyParent(row.parentId, row.label, alerts);
  } catch (error) {
    logger.error("Failed to send parasite risk alert", {
      error,
      subscriptionId: row.id,
    });
    return false;
  }

  if (!notified) return false;

  await persistAlertedTiers();
  return true;
}

/**
 * Refresh every followed cell once, then alert the parents who follow it.
 *
 * Cells are deduplicated first so that a hundred users in the same city cost
 * one weather request.
 */
export async function refreshFollowedCells(): Promise<RefreshSummary> {
  await cleanupCachedCells();

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

  const notifiableParentIds = await loadNotifiableParentIds(subscriptions);

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
      if (await processSubscription(row, reading, notifiableParentIds)) {
        summary.alertsSent += 1;
      }
    }
  }

  logger.info("Parasite risk refresh complete", { ...summary });
  return summary;
}
