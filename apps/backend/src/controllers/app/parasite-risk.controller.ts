import type { Request, Response } from "express";
import { RISK_TIERS, type RiskTier } from "@yosemite-crew/types";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  deleteSubscription,
  getCellRisk,
  listSubscriptions,
  ParasiteRiskServiceError,
  upsertSubscription,
} from "src/services/parasite-risk.service";
import logger from "src/utils/logger";
import { resolveVerifiedUserId } from "src/utils/request";

/**
 * Saved locations belong to the pet parent, not the auth user directly.
 *
 * `req.userId` is the auth provider's user id, while `Parent.linkedUserId`
 * holds the internal AuthUserMobile row id, so the parent is reached through
 * the AuthUserMobile record rather than by matching the two ids directly.
 */
const resolveParentId = async (req: Request): Promise<string | undefined> => {
  const providerUserId = resolveVerifiedUserId(req);
  if (!providerUserId) return undefined;

  const authUser =
    await AuthUserMobileService.getByProviderUserId(providerUserId);

  return authUser?.parentId ?? undefined;
};

/**
 * Accepts both forms, because query strings arrive as strings and JSON bodies
 * arrive as numbers.
 */
const parseCoordinate = (value: unknown, limit: number): number | null => {
  let parsed: number;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    parsed = Number.parseFloat(value);
  } else {
    return null;
  }

  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null;
  return parsed;
};

const parseCountryCode = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
};

const parseAlertTier = (value: unknown): RiskTier | undefined => {
  if (typeof value !== "string") return undefined;
  const tier = value.trim().toUpperCase();
  return (RISK_TIERS as readonly string[]).includes(tier)
    ? (tier as RiskTier)
    : undefined;
};

const handleError = (error: unknown, res: Response, context: string) => {
  if (error instanceof ParasiteRiskServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(context, { error });
  return res.status(500).json({ message: "Internal Server Error" });
};

export const ParasiteRiskController = {
  getRiskForCell: async (req: Request, res: Response) => {
    try {
      const lat = parseCoordinate(req.query.lat, 90);
      const lon = parseCoordinate(req.query.lon, 180);
      const countryCode = parseCountryCode(req.query.countryCode);

      if (lat === null || lon === null) {
        return res
          .status(400)
          .json({ message: "Valid lat and lon query parameters are required" });
      }

      // countryCode is optional: the "use my current location" path has a
      // coordinate but no geocoder, and the region is inferred from the
      // coordinate in that case.
      const reading = await getCellRisk(lat, lon, countryCode);
      return res.status(200).json(reading);
    } catch (error) {
      return handleError(error, res, "Error fetching parasite risk");
    }
  },

  listSubscriptions: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req);
      if (!parentId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      return res.status(200).json(await listSubscriptions(parentId));
    } catch (error) {
      return handleError(error, res, "Error listing followed risk locations");
    }
  },

  createSubscription: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req);
      if (!parentId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const body = req.body as Record<string, unknown>;
      const lat = parseCoordinate(body.lat, 90);
      const lon = parseCoordinate(body.lon, 180);
      const countryCode = parseCountryCode(body.countryCode);

      if (lat === null || lon === null) {
        return res.status(400).json({
          message: "lat and lon are required",
        });
      }

      const subscription = await upsertSubscription(parentId, {
        lat,
        lon,
        countryCode,
        label: typeof body.label === "string" ? body.label : "",
        alertTier: parseAlertTier(body.alertTier),
      });

      return res.status(201).json(subscription);
    } catch (error) {
      return handleError(error, res, "Error following a risk location");
    }
  },

  deleteSubscription: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req);
      if (!parentId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      await deleteSubscription(parentId, req.params.subscriptionId);
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res, "Error unfollowing a risk location");
    }
  },
};
