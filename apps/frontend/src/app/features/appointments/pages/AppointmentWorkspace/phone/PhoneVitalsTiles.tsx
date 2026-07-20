import React from 'react';
import type { Vitals } from '@/app/features/appointments/types/workspace';

type PhoneVitalsTilesProps = {
  /** Body weight (kg) from the companion record, mirroring the signalment weight. */
  weightKg?: number;
  /** Most recently recorded vitals for this visit (drives Temp and HR · RR). */
  latestVitals?: Vitals;
};

const DASH = '—';

const Tile = ({ label, value }: { label: string; value: string }) => (
  <span className="rounded-[11px] bg-(--inset) px-2.5 py-2">
    <span className="block text-[9px] font-bold uppercase tracking-[0.06em] text-(--ink-faint)">
      {label}
    </span>
    <span className="text-[13px] font-bold tabular-nums text-(--ink)">{value}</span>
  </span>
);

const formatWeight = (weightKg?: number): string => (weightKg == null ? DASH : `${weightKg} kg`);

const formatTemp = (tempF?: number): string => (tempF == null ? DASH : `${tempF} °F`);

const formatHrRr = (heartRateBpm?: number, respRateBpm?: number): string => {
  if (heartRateBpm == null && respRateBpm == null) return DASH;
  return `${heartRateBpm ?? DASH} · ${respRateBpm ?? DASH}`;
};

/**
 * The 3-up vitals summary shown above the SOAP editor on phone: Weight (body
 * weight, kg), Temp, and combined HR · RR, read from the latest recorded vitals.
 * Matches the design's inset tiles; missing values render an em dash.
 */
const PhoneVitalsTiles = ({ weightKg, latestVitals }: PhoneVitalsTilesProps) => (
  <div className="grid grid-cols-3 gap-[7px]">
    <Tile label="Weight" value={formatWeight(weightKg)} />
    <Tile label="Temp" value={formatTemp(latestVitals?.tempF)} />
    <Tile
      label="HR · RR"
      value={formatHrRr(latestVitals?.heartRateBpm, latestVitals?.respRateBpm)}
    />
  </div>
);

export default PhoneVitalsTiles;
