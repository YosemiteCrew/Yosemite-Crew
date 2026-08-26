'use client';
import React from 'react';

/**
 * Who a group of settings actually affects.
 *
 * This is not decoration. Settings mixes per-user preferences with controls that
 * change behaviour for every colleague at the clinic, and the two used to sit in
 * undifferentiated cards - so an owner could change the whole clinic believing it
 * was their own preference. Groups declare their scope and say so on screen.
 */
export type PreferenceScope = 'personal' | 'organisation';

const SCOPE_COPY: Record<PreferenceScope, { label: string; hint: string }> = {
  personal: { label: 'Only you', hint: 'These apply to your account on this clinic.' },
  organisation: {
    label: 'Whole clinic',
    hint: 'These apply to everyone at this clinic, not just you.',
  },
};

type PreferenceGroupProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Who the group's controls affect. Renders a scope chip and a one-line hint. */
  scope?: PreferenceScope;
};

/**
 * Grouped-preferences card from the Settings design: a `--screen` surface with a
 * hairline border, the soft two-layer shadow and a bold group title, stacking one
 * or more preference rows/blocks.
 *
 * When `scope` is given the title row also carries a chip naming who the settings
 * affect, plus a faint hint line beneath it.
 */
export const PreferenceGroup = ({ title, children, className, scope }: PreferenceGroupProps) => {
  const copy = scope ? SCOPE_COPY[scope] : null;

  return (
    <section
      className={`flex flex-col gap-[14px] rounded-[18px] border border-[var(--hairline)] bg-[var(--screen)] px-5! py-[18px]! shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)] ${
        className ?? ''
      }`.trim()}
    >
      <div className="flex flex-col gap-[3px]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14.5px] font-bold text-[var(--ink)]">{title}</h3>
          {copy && <ScopeChip scope={scope!} label={copy.label} />}
        </div>
        {copy && <p className="m-0! text-[11.5px] text-[var(--ink-faint)]">{copy.hint}</p>}
      </div>
      {children}
    </section>
  );
};

/**
 * The scope chip. Deliberately not a StatusPill: this labels audience, not state,
 * and must not compete with the status colours used for live/verified/error.
 */
const ScopeChip = ({ scope, label }: { scope: PreferenceScope; label: string }) => (
  <span
    className={`flex-none rounded-full border px-2 py-[2px] text-[10.5px] font-semibold tracking-[0.02em] whitespace-nowrap ${
      scope === 'organisation'
        ? 'border-[var(--blue)] text-[var(--blue)]'
        : 'border-[var(--hairline)] text-[var(--ink-faint)]'
    }`}
  >
    {label}
  </span>
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
