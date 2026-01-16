import React, { useState } from "react";
import { IoIosArrowDown } from "react-icons/io";
import { Secondary } from "../Buttons";

interface AccordionButtonProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  buttonTitle?: string;
  buttonClick?: any;
  showButton?: boolean;
}

const AccordionButton: React.FC<AccordionButtonProps> = ({
  title,
  children,
  defaultOpen = false,
  buttonTitle,
  buttonClick,
  showButton = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-card-border px-6 ${showButton ? "py-2" : "py-[20px]"}`}>
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2"
          onClick={() => setOpen(!open)}
        >
          <IoIosArrowDown
            size={22}
            color="#302f2e"
            className={`text-black-text transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
          <div className="text-heading-3 text-text-primary">
            {title}
          </div>
        </button>
        {showButton && buttonTitle && (
          <Secondary
            href="#"
            onClick={() => buttonClick(true)}
            text={buttonTitle}
          />
        )}
      </div>

      {open && <div className={``}>{children}</div>}
    </div>
  );
};

export default AccordionButton;
