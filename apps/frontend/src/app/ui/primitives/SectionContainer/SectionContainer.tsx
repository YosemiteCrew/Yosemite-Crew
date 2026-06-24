import React from 'react';

type SectionContainerProps = {
  title: string;
  children: React.ReactNode;
  nested?: boolean;
  className?: string;
  titleColor?: string;
  titleSlot?: React.ReactNode;
  /**
   * Suppress the blue focus-within border. Use when the section already wraps a
   * surface that owns its own focus affordance (e.g. the rich text editor), so
   * focusing the inner field does not double up with an outer highlight.
   */
  disableFocusBorder?: boolean;
  /**
   * Tighten the top padding so it matches the bottom padding (≈20px) instead of
   * the default roomy header gap. Use when the first child should sit close to
   * the top, e.g. a rich-text editor whose text/toolbar starts near the border.
   */
  compactTop?: boolean;
  /**
   * Override the floating title's typography (size/weight/colour). When set it
   * replaces the default size + colour — use a shared token class such as
   * `text-yc-20-b-primary` to apply a specific reusable style.
   */
  titleClassName?: string;
  /**
   * Optional node rendered just before the title text on the top border (e.g. a
   * small "+" add affordance). It sits inside the floating title chip.
   */
  titleIcon?: React.ReactNode;
};

const SectionContainer = ({
  title,
  children,
  nested = false,
  className,
  titleColor,
  titleSlot,
  disableFocusBorder = false,
  compactTop = false,
  titleClassName,
  titleIcon,
}: SectionContainerProps) => {
  const titleSize = nested
    ? 'text-[14px] sm:text-[16px] font-medium'
    : 'text-[16px] sm:text-[20px] font-medium';

  const resolvedTitleColor = titleColor ?? 'var(--color-input-border-active)';
  const focusBorder = disableFocusBorder ? '' : 'focus-within:border-input-border-active';
  let topPadding = nested ? 'pt-7' : 'pt-9';
  if (compactTop) topPadding = 'pt-5';

  // A shared token class (`titleClassName`) fully owns the title typography +
  // colour; otherwise fall back to the default size class + inline colour.
  const titleTypography = titleClassName ?? titleSize;
  const titleStyle = titleClassName ? undefined : { color: resolvedTitleColor };

  return (
    <div
      className={`relative rounded-2xl border border-input-border-default ${focusBorder} transition-colors duration-150 pb-5 px-5 ${topPadding} ${className ?? ''}`}
    >
      {/* Title floats on the top border — capped so it never runs into the right
          slot. `leading-snug` (not `leading-none`) gives descenders ('g'/'y')
          room so `truncate`'s overflow-hidden does not clip them. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute top-0 left-4 -translate-y-1/2 flex items-center gap-2 bg-(--whitebg) px-1.5 leading-snug ${titleTypography} ${titleSlot ? 'max-w-[55%] sm:max-w-[60%]' : 'max-w-[calc(100%-2rem)]'}`}
        style={titleStyle}
      >
        {titleIcon}
        <span className="truncate">{title}</span>
      </span>
      {titleSlot && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 right-4 -translate-y-1/2 bg-(--whitebg) px-1.5 leading-none flex items-center gap-1.5 shrink-0"
        >
          {titleSlot}
        </span>
      )}
      {children}
    </div>
  );
};

export default SectionContainer;
