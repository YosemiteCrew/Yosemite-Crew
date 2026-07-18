import React from 'react';
import { IoIosClose } from 'react-icons/io';

type CloseProps = {
  onClick?: () => void;
  iconOnly?: boolean;
  tabIndex?: number;
};

const Close = ({ onClick, iconOnly = false, tabIndex }: CloseProps) => {
  if (iconOnly) {
    return <IoIosClose size={28} color="var(--color-neutral-900)" className="cursor-pointer" />;
  }

  return (
    <button
      type="button"
      aria-label="Close"
      tabIndex={tabIndex}
      className="flex items-center justify-center size-8 rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-hover)] transition-colors duration-200 ease-in-out"
      onClick={onClick}
    >
      <IoIosClose size={16} color="var(--ink-faint)" className="cursor-pointer" />
    </button>
  );
};

export default Close;
