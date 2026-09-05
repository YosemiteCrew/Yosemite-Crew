import type {
  ParasiteRiskCellReading,
  ParasiteRiskSubscriptionRecord,
} from '@yosemite-crew/types';

export type {
  ParasiteGroup,
  ParasiteId,
  ParasiteRiskCellReading,
  ParasiteRiskReading,
  ParasiteRiskSubscriptionRecord,
  RiskTier,
  RiskTrend,
} from '@yosemite-crew/types';

/**
 * A place the user has searched for, or their current position.
 *
 * `countryCode` is absent for the current-location path, which has a
 * coordinate but no geocoded address. The API infers the region from the
 * coordinate in that case.
 */
export interface RiskLocation {
  label: string;
  lat: number;
  lon: number;
  countryCode?: string;
}

export interface ParasiteRiskState {
  /** The location currently being viewed. */
  location: RiskLocation | null;
  reading: ParasiteRiskCellReading | null;
  /** Places the user has looked at before, most recent first. Local only. */
  recentLocations: RiskLocation[];
  subscriptions: ParasiteRiskSubscriptionRecord[];
  loading: boolean;
  subscriptionsLoading: boolean;
  error: string | null;
  /**
   * Whether the user has seen the "modelled guidance, not veterinary advice"
   * notice. Persisted so it is shown once.
   */
  disclaimerAcknowledged: boolean;
}
