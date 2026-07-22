import React from 'react';

type ModalFooterProps = {
  children: React.ReactNode;
  /**
   * How the action row sits in the bar. Defaults to `end` (right-aligned), the
   * layout most panels use. Panels whose actions span the full width - a lone
   * invite/book/save primary, or a paired Discard/Apply - pass `stretch`.
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
