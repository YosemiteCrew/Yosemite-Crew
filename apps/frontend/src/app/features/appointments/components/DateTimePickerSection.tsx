import React from 'react';
import Slotpicker from '@/app/ui/inputs/Slotpicker';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';
import { Slot } from '@/app/features/appointments/types/appointments';

type Option = { label: string; value: string };

type DateInputProps = {
  selectedDate: Date;
  hideDateSlotPicker: boolean;
};

type TimeInputProps = {
  selectedSlot: Slot | null;
  slotError?: string;
  isLoadingSlot: boolean;
};

type LeadSelectorProps = {
  isLoadingSlot: boolean;
  leadId?: string;
  leadError?: string;
  leadOptions: Option[];
  onLeadSelect: (option: Option) => void;
};

type DateTimePickerSectionProps = {
  selectedDate: Date;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  timeSlots: Slot[];
  slotError?: string;
  leadId?: string;
  leadError?: string;
  leadOptions: Option[];
  onLeadSelect: (option: Option) => void;
  supportStaffIds?: string[];
  teamOptions?: Option[];
  onSupportStaffChange?: (ids: string[]) => void;
  showSupportStaff?: boolean;
  hideDateSlotPicker?: boolean;
  isLoadingSlot?: boolean;
};

const LoadingSkeleton = () => <div className="min-h-12 rounded-xl bg-neutral-100 animate-pulse" />;

const DateInput = ({ selectedDate, hideDateSlotPicker }: DateInputProps) => (
  <FormInput
    intype="text"
    inname="date"
    value={getFormattedDate(selectedDate)}
    readonly={hideDateSlotPicker}
    tabIndex={hideDateSlotPicker ? -1 : undefined}
    onFocus={hideDateSlotPicker ? (event) => event.currentTarget.blur() : undefined}
    onClick={hideDateSlotPicker ? (event) => event.preventDefault() : undefined}
    onChange={() => {}}
    inlabel="Date"
    className={`min-h-12! ${hideDateSlotPicker ? 'cursor-default' : ''}`}
  />
);

const TimeInput = ({ selectedSlot, slotError, isLoadingSlot }: TimeInputProps) => {
  if (isLoadingSlot) {
    return <LoadingSkeleton />;
  }

  return (
    <FormInput
      intype="text"
      inname="time"
      value={selectedSlot?.startTime ? formatUtcTimeToLocalLabel(selectedSlot.startTime) : ''}
      readonly
      tabIndex={-1}
      onFocus={(event) => event.currentTarget.blur()}
      onClick={(event) => event.preventDefault()}
      error={slotError}
      onChange={() => {}}
      inlabel="Time"
      className="min-h-12! cursor-default"
    />
  );
};

const LeadSelector = ({
  isLoadingSlot,
  leadId,
  leadError,
  leadOptions,
  onLeadSelect,
}: LeadSelectorProps) => {
  if (isLoadingSlot) {
    return <LoadingSkeleton />;
  }

  return (
    <LabelDropdown
      placeholder="Lead"
      onSelect={onLeadSelect}
      defaultOption={leadId}
      error={leadError}
      options={leadOptions}
    />
  );
};

const DateTimePickerSection = ({
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot,
  timeSlots,
  slotError,
  leadId,
  leadError,
  leadOptions,
  onLeadSelect,
  supportStaffIds,
  teamOptions,
  onSupportStaffChange,
  showSupportStaff = true,
  hideDateSlotPicker = false,
  isLoadingSlot = false,
}: DateTimePickerSectionProps) => (
  <div className="flex flex-col gap-4">
    {!hideDateSlotPicker && (
      <Slotpicker
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedSlot={selectedSlot}
        setSelectedSlot={setSelectedSlot}
        timeSlots={timeSlots}
      />
    )}
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <DateInput selectedDate={selectedDate} hideDateSlotPicker={hideDateSlotPicker} />
        <TimeInput
          selectedSlot={selectedSlot}
          slotError={slotError}
          isLoadingSlot={isLoadingSlot}
        />
      </div>
      <LeadSelector
        isLoadingSlot={isLoadingSlot}
        leadId={leadId}
        leadError={leadError}
        leadOptions={leadOptions}
        onLeadSelect={onLeadSelect}
      />
      {showSupportStaff && teamOptions && onSupportStaffChange && (
        <MultiSelectDropdown
          placeholder="Support"
          value={supportStaffIds || []}
          onChange={onSupportStaffChange}
          options={teamOptions}
        />
      )}
    </div>
  </div>
);

export default DateTimePickerSection;
