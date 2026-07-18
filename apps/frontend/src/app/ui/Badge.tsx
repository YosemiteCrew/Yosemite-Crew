import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type BadgeProps = {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
} & HTMLAttributes<HTMLSpanElement>;

const toneClassMap: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-card-bg text-text-secondary',
  brand: 'bg-primary-600 text-white',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
};

const Badge = ({ tone = 'neutral', className, ...props }: BadgeProps) => {
  return (
    <span
      className={clsx(
        // DS micro-badge: ALL-CAPS 10px / 700 / 0.08em, pad 4px 10px, fully round.
        'inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.08em]',
        toneClassMap[tone],
        className
      )}
      {...props}
    />
  );
};

export default Badge;
