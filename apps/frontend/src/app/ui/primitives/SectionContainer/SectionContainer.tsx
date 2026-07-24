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
   * Tighten the top padding so the header sits closer to the top border. Use
   * when the first child should sit high in the card, e.g. a rich-text editor
   * whose text/toolbar starts near the border.
   */
  compactTop?: boolean;
  /**
   * Override the title's typography (size/weight/colour). When set it replaces
   * the default size + colour — use a shared token class such as
   * `text-yc-20-b-primary` to apply a specific reusable style.
   */
  titleClassName?: string;
  /**
   * Optional node rendered just before the title text in the header row (e.g. a
   * small "+" add affordance). It sits inline, left of the title.
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
  // Plain, static section title — sentence case, 15px/700 on --ink (14px when
  // nested). Matches the design system: no floating chip, no coloured box on the
  // border, transparent background.
  const titleSize = nested ? 'text-[14px]' : 'text-[15px]';

  const focusBorder = disableFocusBorder ? '' : 'focus-within:border-input-border-active';
  const topPadding = compactTop ? 'pt-4' : 'pt-5';

  // A shared token class (`titleClassName`) fully owns the title typography +
  // colour; otherwise fall back to the default size/weight class + inline colour
  // (defaults to --ink, honouring any `titleColor` override).
  const titleTypography = titleClassName ?? `${titleSize} font-bold tracking-[-0.01em]`;
  const titleStyle = titleClassName ? undefined : { color: titleColor ?? 'var(--ink)' };

  return (
    <div
      className={`relative rounded-2xl border border-input-border-default ${focusBorder} transition-colors duration-150 pb-5 px-5 ${topPadding} ${className ?? ''}`}
    >
      {/* Static header row: title (with optional leading icon) on the left, the
          optional slot right-aligned. `truncate` keeps a long title on one line
          while the slot stays pinned right. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className={`flex min-w-0 items-center gap-2 leading-snug ${titleTypography}`}
          style={titleStyle}
        >
          {titleIcon}
          <span className="truncate">{title}</span>
        </span>
        {titleSlot && <span className="flex shrink-0 items-center gap-1.5">{titleSlot}</span>}
      </div>
      {children}
    </div>
  );
};

export default SectionContainer;
