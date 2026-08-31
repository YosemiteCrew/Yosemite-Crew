import React, { useId } from 'react';

type EmergencyCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const EmergencyCheckbox = ({ checked, onChange }: EmergencyCheckboxProps) => {
  const id = useId();
  return (
    <div className="flex items-center gap-2 pt-2">
      {/* No aria-label here: the htmlFor/useId label below already names the input, and an
          aria-label would override it with wording that omits the visible sentence - a WCAG
          2.5.3 label-in-name failure that leaves voice control unable to activate the box. */}
      <input id={id} type="checkbox" checked={checked} onChange={() => onChange(!checked)} />
      <label htmlFor={id} className="text-body-4 text-text-primary cursor-pointer">
        I confirm this is an emergency.
      </label>
    </div>
  );
};

export default EmergencyCheckbox;
