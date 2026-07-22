import React from 'react';

type ModalFooterProps = {
  children: React.ReactNode;
  /**
   * Right-aligns the action row. Panels with a single full-width primary
   * (invite, book, save) keep the default stretch instead.
   */
  align?: 'start' | 'end' | 'stretch';
};

const ALIGNMENT: Record<NonNullable<ModalFooterProps['align']>, string> = {
  start: 'justify-start',
  end: 'justify-end',
  stretch: '[&>*]:flex-1',
};

/**
 * The single action bar for every panel: one hairline rule, one set of paddings.
 * Panels previously re-derived this ten different ways and split across two
 * hairline tokens (`card-border` and `--hairline`) for the same rule; the design
 * draws it once, in `--hairline`, above a 16px gap.
 */
const ModalFooter = ({ children, align = 'end' }: ModalFooterProps) => (
  <div
    className={`mt-4 flex items-center gap-3 border-t border-[var(--hairline)] pt-4 ${ALIGNMENT[align]}`}
  >
    {children}
  </div>
);

export default ModalFooter;
