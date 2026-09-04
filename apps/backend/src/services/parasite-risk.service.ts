import { Prisma, type ParasiteRiskCell } from "@prisma/client";
import {
  snapToRiskCell,
  type ParasiteRiskCellReading,
  type ParasiteRiskReading,
  type ParasiteRiskSubscriptionRecord,
  type RiskRegion,
  type RiskTier,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { fetchCellWeather } from "src/integrations/openMeteo";
import { resolveRegionFor } from "./parasite-catalogue";
import { computeCellReadings, MODEL_VERSION } from "./parasite-risk.model";

/**
 * Reads and caches modelled parasite risk per grid cell.
 *
 * A cell is shared by every user in the same ~25km square, so one weather
 * fetch serves all of them and no individual location is ever persisted.
 */

export class ParasiteRiskServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "ParasiteRiskServiceError";
  }
}

/** Readings are refreshed daily; anything younger than this is served as is. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Never present health guidance older than one week as a usable fallback. */
const MAX_STALE_CACHE_AGE_MS = 7 * CACHE_TTL_MS;

const toReadings = (value: Prisma.JsonValue): ParasiteRiskReading[] =>
  Array.isArray(value) ? (value as unknown as ParasiteRiskReading[]) : [];

const toResponse = (cell: ParasiteRiskCell): ParasiteRiskCellReading => ({
  cell: { lat: cell.latBucket, lon: cell.lonBucket },
  countryCode: cell.countryCode,
  region: cell.region as RiskRegion,
  modelVersion: cell.modelVersion,
  computedAt: cell.computedAt.toISOString(),
  overallTier: cell.overallTier,
  readings: toReadings(cell.readings),
  degraded: cell.degraded,
});

const isFresh = (cell: ParasiteRiskCell, now: number): boolean =>
  now - cell.computedAt.getTime() < CACHE_TTL_MS;

const isUsableFallback = (cell: ParasiteRiskCell, now: number): boolean =>
  now - cell.computedAt.getTime() < MAX_STALE_CACHE_AGE_MS;

/** Remove cache rows that cannot be served by the current model. */
export async function cleanupCachedCells(): Promise<number> {
  const cutoff = new Date(Date.now() - MAX_STALE_CACHE_AGE_MS);
  const result = await prisma.parasiteRiskCell.deleteMany({
    where: {
      OR: [
        { modelVersion: { not: MODEL_VERSION } },
        { computedAt: { lt: cutoff } },
      ],
    },
  });

  return result.count;
}

/**
 * The region a cell is modelled under, or a refusal.
 *
 * Every path resolves the region here, on the snapped cell, so the region a
 * reading is computed under and the region a cached row is checked against are
 * always the same decision.
 */
function regionForCell(
  latBucket: number,
  lonBucket: number,
  countryCode?: string | null,
): RiskRegion {
  const region = resolveRegionFor(countryCode, latBucket, lonBucket);

  if (region === null) {
    throw new ParasiteRiskServiceError(
      "Parasite risk is not published for this location yet",
      404,
    );
  }

  return region;
}

/** Fetch weather for an already-snapped cell, model it, and persist it. */
async function computeCell(
  latBucket: number,
  lonBucket: number,
  region: RiskRegion,
  countryCode?: string | null,
): Promise<ParasiteRiskCellReading> {
  const { past, forecast } = await fetchCellWeather(latBucket, lonBucket);
  const result = computeCellReadings(
    region,
    latBucket,
    lonBucket,
    past,
    forecast,
  );

  const data = {
    countryCode: countryCode?.trim().toUpperCase() ?? region,
    region,
    overallTier: result.overallTier,
    degraded: result.degraded,
    readings: result.readings as unknown as Prisma.InputJsonValue,
    computedAt: new Date(),
  };

  const cell = await prisma.parasiteRiskCell.upsert({
    where: {
      latBucket_lonBucket_modelVersion: {
        latBucket,
        lonBucket,
        modelVersion: MODEL_VERSION,
      },
    },
    create: { latBucket, lonBucket, modelVersion: MODEL_VERSION, ...data },
    update: data,
  });

  return toResponse(cell);
}

/**
 * Compute a cell from live weather and persist it.
 *
 * Exported so the daily worker can force a refresh without going through the
 * cache check.
 */
export async function refreshCell(
  lat: number,
  lon: number,
  countryCode?: string | null,
): Promise<ParasiteRiskCellReading> {
  const { lat: latBucket, lon: lonBucket } = snapToRiskCell(lat, lon);
  const region = regionForCell(latBucket, lonBucket, countryCode);

  return computeCell(latBucket, lonBucket, region, countryCode);
}

/** Serve a cell from cache when it is fresh, otherwise recompute it. */
export async function getCellRisk(
  lat: number,
  lon: number,
  countryCode?: string | null,
): Promise<ParasiteRiskCellReading> {
  const { lat: latBucket, lon: lonBucket } = snapToRiskCell(lat, lon);
  // Resolved before the cache is consulted, so a location we do not publish is
  // refused outright rather than answered from whatever is stored for the cell.
  const region = regionForCell(latBucket, lonBucket, countryCode);

  const cached = await prisma.parasiteRiskCell.findUnique({
    where: {
      latBucket_lonBucket_modelVersion: {
        latBucket,
        lonBucket,
        modelVersion: MODEL_VERSION,
      },
    },
  });

  // One row is shared by every caller in the square and carries the region it
  // was computed under, so a row from another region is not an answer to this
  // request, fresh or stale.
  const usable = cached && cached.region === region ? cached : null;

  if (usable && isFresh(usable, Date.now())) {
    return toResponse(usable);
  }

  try {
    return await computeCell(latBucket, lonBucket, region, countryCode);
  } catch (error) {
    // A stale reading is far more useful than an error page, and the models
    // move slowly enough that yesterday's answer is still broadly right.
    if (usable && isUsableFallback(usable, Date.now())) {
      return toResponse(usable);
    }
    throw error;
  }
}

const toSubscriptionRecord = (row: {
  id: string;
  latBucket: number;
  lonBucket: number;
  countryCode: string;
  label: string;
  alertTier: string;
  createdAt: Date;
}): ParasiteRiskSubscriptionRecord => ({
  id: row.id,
  lat: row.latBucket,
  lon: row.lonBucket,
  countryCode: row.countryCode,
  label: row.label,
  alertTier: row.alertTier as RiskTier,
  createdAt: row.createdAt.toISOString(),
});

export async function listSubscriptions(
  parentId: string,
): Promise<ParasiteRiskSubscriptionRecord[]> {
  const rows = await prisma.parasiteRiskSubscription.findMany({
    where: { parentId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(toSubscriptionRecord);
}

/** Cap saved locations so the daily refresh stays bounded per user. */
const MAX_SUBSCRIPTIONS_PER_PARENT = 5;

/** Long enough for any real place name, short enough to stay a label. */
const MAX_LABEL_LENGTH = 120;

export async function upsertSubscription(
  parentId: string,
  input: {
    lat: number;
    lon: number;
    label: string;
    countryCode?: string | null;
    alertTier?: RiskTier;
  },
): Promise<ParasiteRiskSubscriptionRecord> {
  // Capped because the label is persisted and rendered into push notification
  // copy, so it must not be a channel for unbounded caller-supplied text.
  const label = input.label.trim().slice(0, MAX_LABEL_LENGTH);
  if (label.length === 0) {
    throw new ParasiteRiskServiceError("A location label is required");
  }

  const { lat: latBucket, lon: lonBucket } = snapToRiskCell(
    input.lat,
    input.lon,
  );
  const region = regionForCell(latBucket, lonBucket, input.countryCode);

  const row = await prisma.$transaction(async (tx) => {
    // Serialize this parent's count-and-create sequence. Without the lock,
    // concurrent requests can all observe the same count below the cap.
    const lockKey = `parasite-risk:${parentId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.parasiteRiskSubscription.findUnique({
      where: {
        parentId_latBucket_lonBucket: { parentId, latBucket, lonBucket },
      },
    });

    if (!existing) {
      const count = await tx.parasiteRiskSubscription.count({
        where: { parentId },
      });

      if (count >= MAX_SUBSCRIPTIONS_PER_PARENT) {
        throw new ParasiteRiskServiceError(
          `You can follow at most ${MAX_SUBSCRIPTIONS_PER_PARENT} locations`,
          409,
        );
      }
    }

    return tx.parasiteRiskSubscription.upsert({
      where: {
        parentId_latBucket_lonBucket: { parentId, latBucket, lonBucket },
      },
      create: {
        parentId,
        latBucket,
        lonBucket,
        label,
        countryCode: input.countryCode?.trim().toUpperCase() ?? region,
        alertTier: input.alertTier ?? "HIGH",
      },
      update: {
        label,
        countryCode: input.countryCode?.trim().toUpperCase() ?? region,
        ...(input.alertTier ? { alertTier: input.alertTier } : {}),
      },
    });
  });

  return toSubscriptionRecord(row);
}

export async function deleteSubscription(
  parentId: string,
  subscriptionId: string,
): Promise<void> {
  const id = String(subscriptionId);
  const ownerId = String(parentId);
  const result = await prisma.parasiteRiskSubscription.deleteMany({
    where: { id, parentId: ownerId },
  });

  if (result.count === 0) {
    throw new ParasiteRiskServiceError("Location not found", 404);
  }
}
