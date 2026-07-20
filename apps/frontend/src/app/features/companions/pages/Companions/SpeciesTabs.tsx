'use client';
import React from 'react';
import clsx from 'clsx';
import { SPECIES_TABS, type SpeciesCounts } from './companionsDirectory';

type SpeciesTabsProps = {
  counts: SpeciesCounts;
  activeFilter: string;
  onSelect: (key: string) => void;
};

// Underline species tabs with live Newsreader-italic counts. Selecting a tab
// drives the shared `activeFilter` state (Exotics === the 'other' species key).
const SpeciesTabs = ({ counts, activeFilter, onSelect }: SpeciesTabsProps) => (
  <div role="tablist" aria-label="Filter by species" className="flex items-end gap-4 md:gap-[22px]">
    {SPECIES_TABS.map((tab) => {
      const isActive = (activeFilter || 'all') === tab.key;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          onClick={() => onSelect(tab.key)}
          className={clsx(
            'inline-flex shrink-0 items-baseline gap-[5px] border-b-2 px-px pb-2 text-[12.5px] transition-colors md:pb-[9px] md:text-[13px]',
            isActive
              ? 'border-[var(--ink)] font-bold text-[var(--ink)]'
              : 'border-transparent font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)]'
          )}
        >
          {tab.label}
          <span className="font-newsreader text-[12.5px] italic text-[var(--ink-faint)] md:text-[13px]">
            {counts[tab.countKey]}
          </span>
        </button>
      );
    })}
  </div>
);

export default SpeciesTabs;
