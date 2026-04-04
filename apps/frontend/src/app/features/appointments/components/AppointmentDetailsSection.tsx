import React from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import { Primary } from '@/app/ui/primitives/Buttons';

type Option = { label: string; value: string };

type AppointmentDetailsSectionProps = {
  specialityId?: string;
  specialityError?: string;
  specialitiesOptions: Option[];
  onSpecialitySelect: (option: Option) => void;
  serviceId?: string;
  serviceError?: string;
  servicesOptions: Option[];
  onServiceSelect: (option: Option) => void;
  concern: string;
  concernError?: string;
  onConcernChange: (value: string) => void;
  onConcernFocus?: () => void;
  onConcernBlur?: () => void;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onNext?: () => void;
};

const AppointmentDetailsSection = ({
  specialityId,
  specialityError,
  specialitiesOptions,
  onSpecialitySelect,
  serviceId,
  serviceError,
  servicesOptions,
  onServiceSelect,
  concern,
  concernError,
  onConcernChange,
  onConcernFocus,
  onConcernBlur,
  defaultOpen,
  open,
  onOpenChange,
  onNext,
}: AppointmentDetailsSectionProps) => (
  <Accordion
    title="Appointment details"
    defaultOpen={defaultOpen}
    open={open}
    onOpenChange={onOpenChange}
    showEditIcon={false}
    isEditing={true}
  >
    <div className="flex flex-col gap-3">
      <LabelDropdown
        placeholder="Speciality"
        onSelect={onSpecialitySelect}
        defaultOption={specialityId}
        error={specialityError}
        options={specialitiesOptions}
      />
      <LabelDropdown
        placeholder="Service"
        onSelect={onServiceSelect}
        defaultOption={serviceId}
        error={serviceError}
        options={servicesOptions}
      />
      <FormDesc
        intype="text"
        inname="Describe concern"
        value={concern}
        inlabel="Describe concern"
        error={concernError}
        onChange={(e) => onConcernChange(e.target.value)}
        onFocus={() => onConcernFocus?.()}
        onBlur={() => onConcernBlur?.()}
        className="min-h-[120px]!"
      />
      {onNext ? (
        <div className="flex justify-center pt-3 pb-1">
          <Primary
            href="#"
            text="Next"
            onClick={onNext}
            className="py-[12px] px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 text-body-3-emphasis text-center font-satoshi bg-text-primary text-neutral-0! w-auto min-w-[170px]"
          />
        </div>
      ) : null}
    </div>
  </Accordion>
);

export default AppointmentDetailsSection;
