import React, { useId } from 'react';

type EmergencyCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const EmergencyCheckbox = ({ checked, onChange }: EmergencyCheckboxProps) => {
  const id = useId();
  return (
    <div className="flex items-center gap-2 pt-2">
      <input id={id} type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
      <label htmlFor={id} className="text-body-4 text-text-primary cursor-pointer">
        I confirm this is an emergency.
      </label>
    </div>
  );
};

export default EmergencyCheckbox;
