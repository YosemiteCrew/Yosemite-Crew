import type React from 'react';
import { FiChevronDown } from 'react-icons/fi';
import Switch from '@/app/ui/primitives/Switch/Switch';

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
}) => <Switch checked={checked} disabled={disabled} label={label} onChange={onChange} />;
