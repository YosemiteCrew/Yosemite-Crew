'use client';
import React from 'react';
import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { useTheme, type Appearance } from '@/app/ui/theme';

const APPEARANCE_OPTIONS: ReadonlyArray<SegmentedPillOption<Appearance>> = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Appearance preference — a segmented pill (Auto / Light / Dark) that reads and writes
 * the shared PIMS theme choice. `Auto` follows the OS; `Light`/`Dark` persist an explicit
 * choice via the same `yc-theme` storage the header toggle uses.
 */
const AppearancePreference = () => {
  const { appearance, setAppearance } = useTheme();

  return (
    <div className="bg-[var(--screen)] border border-[var(--hairline)] rounded-[18px] shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="px-5! pt-4! pb-3! border-b border-[var(--hairline)] flex items-center justify-between">
        <div className="text-[16px] font-bold tracking-[-0.01em] text-[var(--ink)]">Appearance</div>
      </div>
      <div className="flex items-center justify-between gap-4 px-5! py-5!">
        <div>
          <div className="text-[13px] font-semibold text-[var(--ink-body)]">Theme</div>
          <div className="text-[11.5px] text-[var(--ink-faint)]">
            Light, dark, or follow the system
          </div>
        </div>
        <SegmentedPill
          options={APPEARANCE_OPTIONS}
          value={appearance}
          onChange={setAppearance}
          ariaLabel="Appearance"
        />
      </div>
    </div>
  );
};

export default AppearancePreference;
