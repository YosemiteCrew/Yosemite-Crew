import type {ColorTokens} from '@/theme/colors';
import type {ParasiteId, RiskTier, RiskTrend} from '../types';

/**
 * Presentation helpers for the risk tiers.
 *
 * Tier is deliberately never communicated by colour alone: each surface pairs
 * the colour with the written tier label and, on the dial, with an angle.
 */

interface TierPresentation {
  /** Key into the mobile i18n resources. */
  labelKey: string;
  color: keyof ColorTokens;
  surface: keyof ColorTokens;
  /** Fraction of the dial sweep, used for the arc and the needle. */
  fill: number;
}

export const TIER_PRESENTATION: Record<RiskTier, TierPresentation> = {
  LOW: {
    labelKey: 'parasiteRisk.tier.low',
    color: 'riskLow',
    surface: 'riskLowSurface',
    fill: 0.18,
  },
  MODERATE: {
    labelKey: 'parasiteRisk.tier.moderate',
    color: 'riskModerate',
    surface: 'riskModerateSurface',
    fill: 0.45,
  },
  HIGH: {
    labelKey: 'parasiteRisk.tier.high',
    color: 'riskHigh',
    surface: 'riskHighSurface',
    fill: 0.72,
  },
  EXTREME: {
    labelKey: 'parasiteRisk.tier.extreme',
    color: 'riskExtreme',
    surface: 'riskExtremeSurface',
    fill: 0.95,
  },
};

export const TREND_PRESENTATION: Record<
  RiskTrend,
  {labelKey: string; icon: string}
> = {
  RISING: {labelKey: 'parasiteRisk.trend.rising', icon: 'trending-up'},
  STEADY: {labelKey: 'parasiteRisk.trend.steady', icon: 'remove'},
  FALLING: {labelKey: 'parasiteRisk.trend.falling', icon: 'trending-down'},
};

/** i18n key for a parasite's display name. */
export const parasiteNameKey = (id: ParasiteId): string =>
  `parasiteRisk.parasite.${id}.name`;

/** i18n key for the one-line description shown under the name. */
export const parasiteSummaryKey = (id: ParasiteId): string =>
  `parasiteRisk.parasite.${id}.summary`;

/** i18n key for what to watch for in the pet. */
export const parasiteSignsKey = (id: ParasiteId): string =>
  `parasiteRisk.parasite.${id}.signs`;

/** i18n key for how the parasite is usually prevented, in general terms. */
export const parasitePreventionKey = (id: ParasiteId): string =>
  `parasiteRisk.parasite.${id}.prevention`;
