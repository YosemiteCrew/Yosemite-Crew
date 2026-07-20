'use client';
import React from 'react';

type PreferenceGroupProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Grouped-preferences card from the Settings design: a `--screen` surface with a
 * hairline border, the soft two-layer shadow and a bold group title, stacking one
 * or more preference rows/blocks. Replaces the previous one-card-per-preference
 * pattern (each with its own header band) so the page matches the design's
 * "Workspace preferences" / "Scheduling & messaging" consolidated cards.
 */
export const PreferenceGroup = ({ title, children, className }: PreferenceGroupProps) => (
  <section
    className={`flex flex-col gap-[14px] rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5! py-[18px]! shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] ${
      className ?? ''
    }`.trim()}
  >
    <h3 className="text-[14.5px] font-bold text-[var(--ink)]">{title}</h3>
    {children}
  </section>
);

type PreferenceRowProps = {
  label: string;
  description?: string;
  children: React.ReactNode;
  /** Vertical alignment of the control against the label block. Defaults to center. */
  align?: 'center' | 'start';
};

/**
 * A single preference row: label + optional description on the left, an inline
 * control (segmented pill / toggle) on the right — the design's row idiom
 * (13px/600 label, 11.5px faint description).
 */
export const PreferenceRow = ({
  label,
  description,
  children,
  align = 'center',
}: PreferenceRowProps) => (
  <div
    className={`flex justify-between gap-3 ${align === 'center' ? 'items-center' : 'items-start'}`}
  >
    <div className="min-w-0">
      <div className="text-[13px] font-semibold text-[var(--ink-body)]">{label}</div>
      {description && <div className="text-[11.5px] text-[var(--ink-faint)]">{description}</div>}
    </div>
    <div className="flex-none">{children}</div>
  </div>
);

export default PreferenceGroup;
