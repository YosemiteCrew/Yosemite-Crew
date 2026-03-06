import React, { useMemo, useState } from 'react';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  DEFAULT_TIMEZONE,
  getPreferredTimeZone,
  getTimezoneOptions,
  setPreferredTimeZone,
} from '@/app/lib/timezone';
import { useNotify } from '@/app/hooks/useNotify';

const TimezonePreference = () => {
  const { notify } = useNotify();
  const options = useMemo(() => getTimezoneOptions(), []);
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getPreferredTimeZone());

  const handleSave = () => {
    const next = selectedTimezone || DEFAULT_TIMEZONE;
    const saved = setPreferredTimeZone(next);
    if (saved) {
      notify('success', {
        title: 'Timezone updated',
        text: 'Your timezone preference has been saved.',
      });
      return;
    }
    notify('error', {
      title: 'Unable to update timezone',
      text: 'Please choose a valid timezone and try again.',
    });
  };

  return (
    <div className="border border-card-border rounded-2xl">
      <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
        <div className="text-body-3 text-text-primary">Timezone</div>
      </div>
      <div className="flex flex-col gap-3 px-6! py-6!">
        <LabelDropdown
          placeholder="Preferred timezone"
          options={options}
          defaultOption={selectedTimezone}
          onSelect={(option) => setSelectedTimezone(option.value)}
        />
        <div className="w-full flex justify-end!">
          <Primary href="#" text="Save timezone" onClick={handleSave} />
        </div>
      </div>
    </div>
  );
};

export default TimezonePreference;
