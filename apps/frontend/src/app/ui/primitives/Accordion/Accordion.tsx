import React, { useState } from 'react';
import { IoPencil, IoTrashOutline } from 'react-icons/io5';
import { IoIosArrowDown } from 'react-icons/io';

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
  /**
   * Override the title text class. Defaults to the panel section title
   * (14px / 700 / --ink), the same weight every drawer section uses.
   */
  titleClassName?: string;
}

/**
 * Icon-only controls are circles (32px hairline ring, --ink-muted glyph), per
 * the design's button geometry; the old pencil/trash glyphs sat bare beside
 * the title at 20px and read as a third button style inside one panel.
 */
const iconButtonClass =
  'flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-muted)] transition-colors hover:border-[var(--hairline-hover)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]';

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
  titleClassName = 'text-[14px] font-bold tracking-[-0.01em]',
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
    <div className="flex w-full flex-col gap-0">
      {/* Section card: the panel's --screen-2 inset surface with a hairline and
          the card radius, so a section reads as one raised block rather than a
          bordered box drawn in two halves. */}
      <div
        className={`flex w-full items-center justify-between gap-3 border border-[var(--hairline)] bg-[var(--screen-2)] px-[14px] py-[10px] ${
          open && hasChildren ? 'rounded-t-[16px] border-b-0' : 'rounded-[16px]'
        }`}
      >
        <button
          type="button"
          className="flex min-h-8 flex-1 items-center gap-2.5 text-left"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={title}
        >
          <IoIosArrowDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-[var(--ink-muted)] transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className={`${titleClassName} text-[var(--ink)] text-left`}>{title}</span>
        </button>

        <div className="flex items-center gap-2">
          {rightElement}

          {showEditIcon && !isEditing && (
            <button
              type="button"
              aria-label={`Edit ${title}`}
              className={iconButtonClass}
              onClick={() => {
                setOpen(true);
                onEditClick?.();
              }}
              onKeyDown={handleEditKeyDown}
            >
              <IoPencil size={14} aria-hidden="true" />
            </button>
          )}

          {showDeleteIcon && !isEditing && (
            <button
              type="button"
              aria-label={`Delete ${title}`}
              className={`${iconButtonClass} border-[var(--danger-border)] text-[var(--danger-text)] hover:border-[var(--danger)] hover:text-[var(--danger-text)]`}
              onClick={() => onDeleteClick?.()}
              onKeyDown={handleDeleteKeyDown}
            >
              <IoTrashOutline size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {open && hasChildren && (
        <div className="rounded-b-[16px] border border-t-0 border-[var(--hairline)] bg-[var(--screen)] px-[14px] pb-3 pt-3">
          {children}
        </div>
      )}
    </div>
  );
};

export default Accordion;
