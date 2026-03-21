import React from 'react';

type EmergencyCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const EmergencyCheckbox = ({ checked, onChange }: EmergencyCheckboxProps) => (
  <div className="flex items-center gap-2 pt-2">
    <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
    <div className="text-body-4 text-text-primary">I confirm this is an emergency.</div>
  </div>
);

export default EmergencyCheckbox;
