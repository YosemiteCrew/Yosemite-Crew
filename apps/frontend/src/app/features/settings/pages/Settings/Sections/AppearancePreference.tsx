'use client';
import React from 'react';
import SegmentedPill, {
  SegmentedPillOption,
} from '@/app/ui/primitives/SegmentedPill/SegmentedPill';
import { useTheme, type Appearance } from '@/app/ui/theme';
import { PreferenceRow } from './PreferenceGroup';

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
    <PreferenceRow label="Appearance" description="Light, dark, or follow the system">
      <SegmentedPill
        options={APPEARANCE_OPTIONS}
        value={appearance}
        onChange={setAppearance}
        ariaLabel="Appearance"
      />
    </PreferenceRow>
  );
};

export default AppearancePreference;
