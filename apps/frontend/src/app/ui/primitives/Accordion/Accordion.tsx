import React, { useState } from 'react';
import { RiEdit2Fill } from 'react-icons/ri';
import { IoIosArrowDown } from 'react-icons/io';
import { MdDeleteForever } from 'react-icons/md';

export interface AccordionProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  showEditIcon?: boolean;
  onEditClick?: () => void;
  isEditing?: boolean;
  showDeleteIcon?: boolean;
  onDeleteClick?: () => void;
  rightElement?: React.ReactNode;
  /** Controlled open state. When provided the component is controlled. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  rightElement,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (controlledOpen == null) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const hasChildren = children && !(Array.isArray(children) && children.length === 0);

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      onEditClick?.();
    }
  };

  const handleDeleteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onDeleteClick?.();
    }
  };

  return (
    <div className="flex flex-col w-full gap-0">
      <div
        className={`flex items-center justify-between w-full border-card-border px-3 py-3 ${open ? 'border-x border-t rounded-t-2xl' : 'border rounded-2xl'}`}
      >
        <button
          type="button"
          className="flex flex-1 items-center gap-2.5 text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={title}
        >
          <IoIosArrowDown
            size={20}
            aria-hidden="true"
            className={`text-black-text transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="text-body-2 text-text-primary text-left">{title}</span>
        </button>

        <div className="flex items-center gap-2" role="group" aria-label={`${title} actions`}>
          {rightElement}

          {showEditIcon && !isEditing && (
            <button
              type="button"
              aria-label={`Edit ${title}`}
              className="flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand rounded"
              onClick={() => {
                setOpen(true);
                onEditClick?.();
              }}
              onKeyDown={handleEditKeyDown}
            >
              <RiEdit2Fill size={20} color="#302f2e" aria-hidden="true" />
            </button>
          )}

          {showDeleteIcon && !isEditing && (
            <button
              type="button"
              aria-label={`Delete ${title}`}
              className="flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-600 rounded"
              onClick={() => onDeleteClick?.()}
              onKeyDown={handleDeleteKeyDown}
            >
              <MdDeleteForever size={20} color="#EA3729" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div className="pb-2 px-3 border-x border-b border-card-border rounded-b-2xl">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
