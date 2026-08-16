import React from 'react';

type SlotCreateButtonProps = {
  label: string;
  onPick: (clientY: number, container: HTMLDivElement) => void;
};

/** Invisible full-slot click layer that books the minute under the pointer. */
const SlotCreateButton = ({ label, onPick }: SlotCreateButtonProps) => {
  const pickFromEvent = (event: React.MouseEvent<HTMLButtonElement>) => {
    const parent = event.currentTarget.parentElement as HTMLDivElement;
    onPick(event.clientY, parent);
  };

  return (
    <button
      type="button"
      aria-label={label}
      className="absolute inset-0 z-1 rounded-none!"
      onClick={pickFromEvent}
      onDoubleClick={pickFromEvent}
    />
  );
};

export default SlotCreateButton;
