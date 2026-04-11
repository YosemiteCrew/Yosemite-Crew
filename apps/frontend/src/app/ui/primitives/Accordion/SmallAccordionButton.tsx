import React, { useState } from "react";
import { IoIosArrowDown } from "react-icons/io";

interface SmallAccordionButtonProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  buttonTitle?: string;
  buttonClick?: any;
  showButton?: boolean;
}

const SmallAccordionButton: React.FC<SmallAccordionButtonProps> = ({
  title,
  children,
  defaultOpen = false,
  buttonTitle,
  buttonClick,
  showButton = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-card-border px-6 py-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2"
          onClick={() => setOpen(!open)}
        >
          <IoIosArrowDown
            size={20}
            color="#302f2e"
            className={`text-black-text transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
          <div className="text-body-3 text-text-primary">
            {title}
          </div>
        </button>
        {showButton && (
          <button
            onClick={() => buttonClick(true)}
            className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out px-4 py-2 border border-black-text! rounded-2xl! font-satoshi text-black-text text-[1rem] font-medium"
          >
            {buttonTitle}
          </button>
        )}
      </div>

      {open && <div className={``}>{children}</div>}
    </div>
  );
};

export default SmallAccordionButton;
