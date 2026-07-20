import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type SecondaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'> & {
  /** Red outlined variant — red border, text and icon. Use for destructive actions. */
  danger?: boolean;
};

const sizeClasses: Record<ButtonSize, string> = {
  compact: 'min-h-8 px-[14px] text-[12px]',
  small: 'min-h-9 px-4 text-[12.5px]',
  default: 'min-h-10 px-[18px] text-[13.5px]',
  large: 'min-h-11 px-5 text-[13.5px]',
};

const commonClasses =
  'gap-[7px] flex items-center justify-center rounded-full! transition-all duration-200 ease-out font-semibold text-center font-satoshi border';

const defaultClasses = `${commonClasses} border-[var(--divider)]! text-[var(--ink-body)]! hover:text-[var(--blue)]! hover:border-[var(--blue)]!`;

const dangerClasses = `${commonClasses} border-[var(--danger-border)]! text-[var(--danger-text)]! hover:border-[var(--danger)]! hover:text-[var(--danger)]! hover:bg-[var(--danger-bg)]!`;

const Secondary = ({ danger, ...props }: Readonly<SecondaryProps>) => (
  <BaseButton
    {...props}
    sizeClasses={sizeClasses}
    baseClasses={danger ? dangerClasses : defaultClasses}
  />
);

export default Secondary;
