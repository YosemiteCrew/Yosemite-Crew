import type { ReactNode } from 'react';

import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';

export type BadgeProps = {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
  children?: ReactNode;
};

const toneMap: Record<NonNullable<BadgeProps['tone']>, StatusTone> = {
  neutral: 'neutral',
  brand: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

const Badge = ({ tone = 'neutral', className, children }: BadgeProps) => (
  <StatusPill label={children} tone={toneMap[tone]} className={className} />
);

export default Badge;
