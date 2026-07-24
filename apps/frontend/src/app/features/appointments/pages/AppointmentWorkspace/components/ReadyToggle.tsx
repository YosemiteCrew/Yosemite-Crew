import React from 'react';
import { IoCheckmarkOutline } from 'react-icons/io5';
import type { ReadyState } from '@/app/features/appointments/types/workspace';
import { formatStampDate, formatStampTime } from '@/app/lib/appointmentWorkspace';

type ReadyToggleProps = {
  label: string;
  state: ReadyState;
  disabled?: boolean;
  onToggle: () => void;
};

/** Compose the design's "Today, 10:25 AM" stamp from the shared formatters. */
const formatStamp = (iso?: string): string => {
  const date = formatStampDate(iso);
  const time = formatStampTime(iso);
  if (!date || !time) return '';
  return `${date}, ${time}`;
};

/**
 * Ready-for-Billing / Ready-for-Discharge toggle. A bare 18px checkbox plus its
 * label — unchecked is a hairline box on muted ink; checked fills the box with
 * the success green and appends the acting employee + timestamp inline
 * ("Ready for billing · Dr. Weber 09:14").
 */
const ReadyToggle = ({ label, state, disabled = false, onToggle }: ReadyToggleProps) => {
  const checked = state.value;
  const showStamp = checked && Boolean(state.byName || state.at);
  const stampParts = [state.byName ?? 'Clinical team', formatStamp(state.at)].filter(Boolean);

  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex items-center gap-[7px] text-left text-[12.5px] font-semibold leading-[120%] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand disabled:cursor-not-allowed disabled:opacity-60"
      style={{ color: checked ? 'var(--success)' : 'var(--ink-muted)' }}
    >
      <span
        aria-hidden="true"
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors duration-150"
        style={{
          background: checked ? 'var(--success)' : 'transparent',
          borderColor: checked ? 'var(--success)' : 'var(--divider)',
          color: '#ffffff',
        }}
      >
        {checked && <IoCheckmarkOutline size={12} />}
      </span>
      <span>
        {label}
        {showStamp ? ` · ${stampParts.join(' ')}` : ''}
      </span>
    </button>
  );
};

export default ReadyToggle;
