import React, { useState } from "react";
import { RiEdit2Fill } from "react-icons/ri";
import { IoIosArrowDown } from "react-icons/io";
import { MdDeleteForever } from "react-icons/md";

interface AccordionProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  showEditIcon?: boolean;
  onEditClick?: () => void;
  isEditing?: boolean;
  showDeleteIcon?: boolean;
  onDeleteClick?: () => void;
}

const Accordion: React.FC<AccordionProps> = ({
  title,
  children,
  defaultOpen = false,
  showEditIcon = true,
  onEditClick,
  isEditing,
  showDeleteIcon = false,
  onDeleteClick,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const hasChildren =
    children && !(Array.isArray(children) && children.length === 0);

  return (
    <div className={`flex flex-col ${open ? "gap-1" : "gap-0"}`}>
      <div className={`flex items-center justify-between border-card-border px-3 py-3 ${open ? "border-x border-t rounded-t-2xl" : "border rounded-2xl"}`}>
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
          <div className="text-body-2 text-text-primary text-left">
            {title}
          </div>
        </button>
        <div className="flex items-center gap-2">
          {showEditIcon && !isEditing && (
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
          {showDeleteIcon && !isEditing && (
            <MdDeleteForever
              size={20}
              color="#EA3729"
              className="cursor-pointer"
              onClick={() => {
                onDeleteClick?.();
              }}
            />
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div
          className={`pb-2 px-3 border-x border-b border-card-border rounded-b-2xl`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
