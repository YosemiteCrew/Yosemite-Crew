import React from 'react';
import Close from '@/app/ui/primitives/Icons/Close';

type ModalHeaderProps = {
  title: string;
  onClose: () => void;
  /**
   * Uppercase kicker above the title naming the kind of panel ("Record detail").
   * The design uses it on detail peeks, not on form panels.
   */
  eyebrow?: string;
  /** Supporting line under the title: identifiers, timestamps, counts. */
  meta?: React.ReactNode;
  /** Leading glyph rendered before the title, inside the title row. */
  icon?: React.ReactNode;
  /** Header-level controls that sit left of the close button. */
  actions?: React.ReactNode;
  /** Wired to the shell's aria-labelledby so the title names the dialog. */
  titleId?: string;
};

/**
 * The single header for every panel. Type comes from the design files, measured
 * at 1:1 off the Records "Record detail" and Inventory "Restock" drawers:
 * eyebrow 12px/700 uppercase +0.12em, title 17px/700 -0.02em, meta 12.5px/400.
 *
 * The title is left-aligned. Panels used to pad the row with an invisible
 * `size-8` spacer to optically centre it; the design left-aligns, so callers
 * drop the spacer rather than reproducing it here.
 */
const ModalHeader = ({
  title,
  onClose,
  eyebrow,
  meta,
  icon,
  actions,
  titleId,
}: ModalHeaderProps) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex min-w-0 flex-col gap-[3px]">
      {eyebrow && (
        <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
          {eyebrow}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2
          id={titleId}
          className="truncate text-[17px] font-bold tracking-[-0.02em] text-[var(--ink)]"
        >
          {title}
        </h2>
      </div>
      {meta && <span className="text-[12.5px] text-[var(--ink-faint)]">{meta}</span>}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {actions}
      <Close onClick={onClose} />
    </div>
  </div>
);

export default ModalHeader;
