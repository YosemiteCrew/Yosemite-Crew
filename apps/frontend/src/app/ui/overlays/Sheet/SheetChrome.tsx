'use client';

import React from 'react';
import { IoClose } from 'react-icons/io5';

import './Sheet.css';

export type SheetChromeProps = {
  children: React.ReactNode;
  /**
   * Renders the sheet's own title + close row. Omit it when the content already
   * supplies a header (e.g. Modal callers that render `ModalHeader`), so the
   * two never double up.
   */
  title?: string;
  /** Id for the title element, for the owning dialog's `aria-labelledby`. */
  titleId?: string;
  /** Required alongside `title` — the close button in the title row. */
  onClose?: () => void;
  /** Optional footer region for full-width stacked buttons. */
  footer?: React.ReactNode;
};

/**
 * The inside of a phone sheet, per "Modals -> bottom sheets. Phones get a
 * grabber, top radius 24, full-width buttons": the grabber, an optional title +
 * close row, a scrollable body, and an optional footer.
 *
 * Presentation only — the owning component supplies the `<dialog>`, the
 * backdrop, and all focus/Escape/outside-click behaviour. Shared by
 * `PhoneShell/BottomSheet` (standalone sheets) and `overlays/Modal` (the phone
 * form of `variant="centered"`) so there is exactly one grabber implementation.
 * The top radius and skin live on the panel class in Sheet.css.
 */
const SheetChrome = ({ children, title, titleId, onClose, footer }: SheetChromeProps) => (
  <>
    <span className="yc-phone-sheet-grabber" aria-hidden />
    {title === undefined ? null : (
      <div className="yc-phone-sheet-head">
        <h2 id={titleId} className="yc-phone-sheet-title">
          {title}
        </h2>
        <button type="button" className="yc-phone-sheet-close" onClick={onClose} aria-label="Close">
          <IoClose size={15} aria-hidden />
        </button>
      </div>
    )}
    <div className="yc-phone-sheet-body">{children}</div>
    {footer ? <div className="yc-phone-sheet-footer">{footer}</div> : null}
  </>
);

export default SheetChrome;
