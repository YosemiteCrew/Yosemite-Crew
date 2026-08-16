import React from 'react';
import { IoIosClose } from 'react-icons/io';

type CloseProps = {
  onClick?: () => void;
  iconOnly?: boolean;
  tabIndex?: number;
  /**
   * Panels that must not be dismissed mid-flight (a dispense in progress, an
   * upload) pass this so the control reads as unavailable rather than silently
   * ignoring the click.
   */
  isDisabled?: boolean;
};

const Close = ({ onClick, iconOnly = false, tabIndex, isDisabled = false }: CloseProps) => {
  if (iconOnly) {
    return <IoIosClose size={28} color="var(--color-neutral-900)" className="cursor-pointer" />;
  }

  return (
    <button
      type="button"
      aria-label="Close"
      tabIndex={tabIndex}
      disabled={isDisabled}
      className={`flex items-center justify-center size-8 rounded-full border border-[var(--hairline)] transition-colors duration-200 ease-in-out ${
        isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:border-[var(--hairline-hover)]'
      }`}
      onClick={onClick}
    >
      <IoIosClose size={16} color="var(--ink-faint)" className="cursor-pointer" />
    </button>
  );
};

export default Close;
