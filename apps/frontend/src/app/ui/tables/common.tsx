import React from 'react';
import { IoEye, IoFileTrayOutline } from 'react-icons/io5';
import { IoIosCalendar } from 'react-icons/io';

export type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

export type EmptyStateCta = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type NoDataMessageProps = {
  /** Headline — falls back to "No data available". A bare string still works. */
  title?: string;
  /** Optional muted supporting line. */
  subtitle?: string;
  /** Optional icon rendered inside the 64px blue-soft chip. */
  icon?: React.ReactNode;
  /** Optional primary call to action (renders as a link when `href` is set). */
  cta?: EmptyStateCta;
};

const CTA_CLASS =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-primary-600 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-700';

/**
 * Shared empty-state per the DS recipe: centered, a 64px `--blue-soft` icon chip,
 * a Newsreader 20px title, a 13.5px muted sub, and an optional primary CTA.
 * Tables/lists that only have a string can pass it as `title` and it renders in
 * the recipe.
 */
export const NoDataMessage = ({
  title = 'No data available',
  subtitle,
  icon,
  cta,
}: NoDataMessageProps = {}) => (
  <div className="flex w-full flex-col items-center justify-center gap-3 px-4 py-10 text-center">
    <div
      aria-hidden="true"
      className="flex size-16 items-center justify-center rounded-2xl"
      style={{ backgroundColor: 'var(--blue-soft)' }}
    >
      {icon ?? <IoFileTrayOutline size={26} color="var(--color-primary-600)" />}
    </div>
    <div className="flex flex-col gap-1">
      <div className="font-newsreader text-[20px] leading-tight text-text-primary">{title}</div>
      {subtitle ? <div className="text-[13.5px] text-text-secondary">{subtitle}</div> : null}
    </div>
    {cta ? (
      cta.href ? (
        <a href={cta.href} onClick={cta.onClick} className={CTA_CLASS}>
          {cta.label}
        </a>
      ) : (
        <button type="button" onClick={cta.onClick} className={CTA_CLASS}>
          {cta.label}
        </button>
      )
    ) : null}
  </div>
);

type ActionButtonProps = {
  onClick: () => void;
};

export const ViewButton = ({ onClick }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
  >
    <IoEye size={18} color="var(--color-neutral-900)" />
  </button>
);

export const RescheduleButton = ({ onClick }: ActionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="hover:shadow-[0_0_8px_0_rgba(0,0,0,0.16)] size-10 rounded-full! border border-black-text! flex items-center justify-center cursor-pointer"
  >
    <IoIosCalendar size={18} color="var(--color-neutral-900)" />
  </button>
);

export const ProfileTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="appointment-profile-title">{children}</div>
);

export const ProfileSubtitle = ({ children }: { children: React.ReactNode }) => (
  <div className="appointment-profile-sub truncate">{children}</div>
);
