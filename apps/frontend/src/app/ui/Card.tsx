import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

export type CardProps = {
  variant?: 'default' | 'bordered' | 'subtle';
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const variantClassMap: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-neutral-0 border border-card-border yc-card-elevated',
  bordered: 'bg-neutral-0 border border-card-border yc-card-elevated',
  subtle: 'bg-card-bg border border-card-border',
};

const Card = ({ variant = 'default', className, ...props }: CardProps) => {
  return <div className={clsx('rounded-2xl', variantClassMap[variant], className)} {...props} />;
};

export default Card;
