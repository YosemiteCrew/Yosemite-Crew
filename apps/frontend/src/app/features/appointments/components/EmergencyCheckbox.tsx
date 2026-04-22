import React from 'react';

type EmergencyCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const EmergencyCheckbox = ({ checked, onChange }: EmergencyCheckboxProps) => (
  <div className="flex items-center gap-2 pt-2">
    <input
      id="appointment-emergency-checkbox"
      type="checkbox"
      checked={checked}
      onChange={() => onChange(!checked)}
    />
    <label
      htmlFor="appointment-emergency-checkbox"
      className="text-body-4 text-text-primary cursor-pointer"
    >
      I confirm this is an emergency.
    </label>
  </div>
);

export default EmergencyCheckbox;
