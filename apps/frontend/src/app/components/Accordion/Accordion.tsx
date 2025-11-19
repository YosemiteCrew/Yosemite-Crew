import React, { useState } from "react";
import { RiEdit2Fill } from "react-icons/ri";
import { IoIosAdd, IoIosArrowDown } from "react-icons/io";

interface AccordionProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  showEditIcon?: boolean;
  onEditClick?: () => void;
  isEditing?: boolean;
  hasData?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  showEditIcon = true,
  onEditClick,
  isEditing,
  hasData = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const hasChildren =
    children && !(Array.isArray(children) && children.length === 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2.5"
          onClick={() => setOpen(!open)}
        >
          <IoIosArrowDown
            size={20}
            className={`text-black-text transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
          <div className="font-grotesk text-black-text text-[19px] font-medium">
            {title}
          </div>
        </button>
        {showEditIcon && hasData && !isEditing && (
          <RiEdit2Fill
            size={20}
            color="#302f2e"
            className="cursor-pointer"
            onClick={() => {
              setOpen(true);
              onEditClick?.();
            }}
          />
        )}
        {!hasData && (
          <IoIosAdd
            size={28}
            color="#302f2e"
            className="cursor-pointer"
            onClick={() => {
              setOpen(true);
              onEditClick?.();
            }}
          />
        )}
      </div>

      {open && hasChildren && (
        <div
          className={`${isEditing ? "py-2.5!" : "px-4! py-2.5! rounded-2xl border border-grey-light"}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
