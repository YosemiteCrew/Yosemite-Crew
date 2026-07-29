/**
 * Shared contracts for the local parasite risk forecast.
 *
 * The index is *modelled* from climate data, not observed from case reports.
 * Any surface that renders it must say so; see the disclaimer copy in the
 * mobile feature.
 */

/** Ordered from least to most severe. Index positions are used for comparison. */
export const RISK_TIERS = ['LOW', 'MODERATE', 'HIGH', 'EXTREME'] as const;

export type RiskTier = (typeof RISK_TIERS)[number];

/** Regions we publish a catalogue for. Derived from the cell's country code. */
export type RiskRegion = 'AU' | 'US' | 'EU';

export type ParasiteId =
  | 'heartworm'
  | 'paralysis_tick'
  | 'brown_dog_tick'
  | 'blacklegged_tick'
  | 'lone_star_tick'
  | 'american_dog_tick'
  | 'castor_bean_tick'
  | 'ornate_dog_tick'
  | 'flea'
  | 'sandfly_leishmania'
  | 'lungworm'
  | 'intestinal_worms';

/** Broad grouping used for filtering and for matching prevention tasks. */
export type ParasiteGroup = 'TICK' | 'FLEA' | 'WORM' | 'VECTOR_BORNE';

export type RiskTrend = 'RISING' | 'STEADY' | 'FALLING';

export interface ParasiteRiskReading {
  parasiteId: ParasiteId;
  group: ParasiteGroup;
  /** 0-100, normalised per parasite. Not a probability and not a case count. */
  index: number;
  tier: RiskTier;
  /** Direction over the next seven days, from forecast weather. */
  trend: RiskTrend;
}

export interface RiskCellCoordinates {
  /** Centre of the grid cell, not the caller's exact position. */
  lat: number;
  lon: number;
}

export interface ParasiteRiskCellReading {
  cell: RiskCellCoordinates;
  countryCode: string;
  region: RiskRegion;
  modelVersion: string;
  /** ISO 8601. Readings are refreshed daily. */
  computedAt: string;
  /** Highest tier across all readings, for at-a-glance display. */
  overallTier: RiskTier;
  readings: ParasiteRiskReading[];
  /**
   * True when a weather input was unavailable and a neutral fallback was used.
   * Callers should soften the confidence of the wording when set.
   */
  degraded: boolean;
}

export interface ParasiteRiskSubscriptionInput {
  lat: number;
  lon: number;
  /** Caller-supplied place name. Stored so alerts can name the location. */
  label: string;
  countryCode: string;
  /** Alert only when a parasite reaches this tier or above. */
  alertTier?: RiskTier;
}

export interface ParasiteRiskSubscriptionRecord extends ParasiteRiskSubscriptionInput {
  id: string;
  alertTier: RiskTier;
  createdAt: string;
}

/** Size of a grid cell in degrees. Roughly 25 km, and deliberately coarse. */
export const RISK_CELL_SIZE_DEG = 0.25;

/**
 * Snap a coordinate to the centre of its grid cell.
 *
 * Callers snap before sending a position to the API so that a precise device
 * location never leaves the device.
 */
export function snapToRiskCell(lat: number, lon: number): RiskCellCoordinates {
  const snap = (value: number): number => {
    const cell = Math.floor(value / RISK_CELL_SIZE_DEG) * RISK_CELL_SIZE_DEG;
    // Round to 3dp so the same cell always serialises identically.
    return Math.round((cell + RISK_CELL_SIZE_DEG / 2) * 1000) / 1000;
  };

  return { lat: snap(lat), lon: snap(lon) };
}

export function isMoreSevereTier(candidate: RiskTier, current: RiskTier): boolean {
  return RISK_TIERS.indexOf(candidate) > RISK_TIERS.indexOf(current);
}

export function isTierAtLeast(candidate: RiskTier, minimum: RiskTier): boolean {
  return RISK_TIERS.indexOf(candidate) >= RISK_TIERS.indexOf(minimum);
}
