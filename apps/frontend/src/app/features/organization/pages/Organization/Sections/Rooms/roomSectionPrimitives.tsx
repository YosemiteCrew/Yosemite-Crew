import type React from 'react';
import { FiChevronDown } from 'react-icons/fi';

type SectionHeaderProps = {
  title: string;
  meta?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
};

export const SectionHeader = ({ title, meta, open, onToggle, action }: SectionHeaderProps) => (
  <div className="flex items-center justify-between gap-3">
    <button
      type="button"
      onClick={onToggle}
      className="flex min-w-0 items-center gap-3 text-left text-body-3-emphasis text-text-primary"
      aria-expanded={open}
    >
      <FiChevronDown
        size={18}
        aria-hidden="true"
        className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
      />
      <span>{title}</span>
    </button>
    <div className="flex shrink-0 items-center gap-3">
      {meta}
      {action}
    </div>
  </div>
);

export const ToggleSwitch = ({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="inline-flex h-6 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    style={{
      backgroundColor: checked ? 'var(--color-success-bright)' : 'var(--color-neutral-300)',
    }}
  >
    <span
      aria-hidden="true"
      className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-0'
      }`}
    />
  </button>
);
