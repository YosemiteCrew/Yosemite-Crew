import React from 'react';
import { IoPerson } from 'react-icons/io5';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

type StaffInputProps = {
  label: string;
  value: string;
};

const StaffInput = ({ label, value }: StaffInputProps) => (
  <div className="relative min-w-0">
    <span className="pointer-events-none absolute left-5 top-0 z-10 flex -translate-y-1/2 items-center gap-1 bg-[var(--screen)] px-1 text-[11px] font-semibold text-[var(--ink-soft)]">
      <IoPerson size={12} className="text-[var(--ink-faint)]" aria-hidden="true" />
      {label}
    </span>
    <FormInput
      intype="text"
      inname={`appointment-popover-${label.toLowerCase()}`}
      inlabel=""
      value={value || '-'}
      readonly
      tabIndex={-1}
      className="px-4! whitespace-normal wrap-break-word"
    />
  </div>
);

export default StaffInput;
