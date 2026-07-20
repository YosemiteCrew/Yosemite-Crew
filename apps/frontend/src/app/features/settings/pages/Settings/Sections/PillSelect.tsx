'use client';
import React from 'react';
import { IoChevronDownOutline } from 'react-icons/io5';
import '@/app/features/settings/styles/Settings.css';

export type PillSelectOption = {
  value: string;
  label: string;
};

type PillSelectProps = {
  /** Accessible name for the control — the row label it sits against. */
  ariaLabel: string;
  value: string;
  options: ReadonlyArray<PillSelectOption>;
  onChange: (value: string) => void;
  id?: string;
};

/**
 * The design's compact inline dropdown pill used on Settings preference rows:
 * a 36px `--field-bg` pill with a 1.5px hairline border, 12.5px/600 body text and
 * a faint chevron. Built on a native `<select>` so keyboard and screen-reader
 * behaviour comes for free; the pill chrome lives in `styles/Settings.css` so the
 * colours stay theme-live.
 */
const PillSelect = ({ ariaLabel, value, options, onChange, id }: PillSelectProps) => (
  <span className="yc-settings-pill-select-wrap">
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="yc-settings-pill-select"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <span className="yc-settings-pill-chevron" aria-hidden="true">
      <IoChevronDownOutline size={12} />
    </span>
  </span>
);

export default PillSelect;
