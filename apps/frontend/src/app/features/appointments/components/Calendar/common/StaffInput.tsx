import React from 'react';
import { IoPerson } from 'react-icons/io5';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';

type StaffInputProps = {
  label: string;
  value: string;
};

const StaffInput = ({ label, value }: StaffInputProps) => (
  <div className="relative min-w-0">
    <span className="text-yc-12-m-neutral pointer-events-none absolute left-5 top-0 z-10 flex -translate-y-1/2 items-center gap-1 bg-neutral-0 px-1">
      <IoPerson size={12} className="text-neutral-900" aria-hidden="true" />
      {label}
    </span>
    <FormInput
      intype="text"
      inname={`appointment-popover-${label.toLowerCase()}`}
      inlabel=""
      value={value || '-'}
      readonly
      tabIndex={-1}
      className="text-yc-16-r-neutral px-4! whitespace-normal wrap-break-word"
    />
  </div>
);

export default StaffInput;
