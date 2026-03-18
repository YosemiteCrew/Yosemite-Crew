import React from 'react';
import Slotpicker from '@/app/ui/inputs/Slotpicker';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import MultiSelectDropdown from '@/app/ui/inputs/MultiSelectDropdown';
import { getFormattedDate } from '@/app/features/appointments/components/Calendar/weekHelpers';
import { formatUtcTimeToLocalLabel } from '@/app/features/appointments/components/Availability/utils';
import { Slot } from '@/app/features/appointments/types/appointments';

type Option = { label: string; value: string };

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
}: DateTimePickerSectionProps) => (
  <div className="flex flex-col gap-4">
    <Slotpicker
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      selectedSlot={selectedSlot}
      setSelectedSlot={setSelectedSlot}
      timeSlots={timeSlots}
    />
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <FormInput
          intype="text"
          inname="date"
          value={getFormattedDate(selectedDate)}
          onChange={() => {}}
          inlabel="Date"
          className="min-h-12!"
        />
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
      </div>
      <LabelDropdown
        placeholder="Lead"
        onSelect={onLeadSelect}
        defaultOption={leadId}
        error={leadError}
        options={leadOptions}
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
