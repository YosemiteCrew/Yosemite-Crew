import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type SecondaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'> & {
  /** Red outlined variant — red border, text and icon. Use for destructive actions. */
  danger?: boolean;
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-10',
  large: 'min-h-11',
};

const commonClasses =
  'px-5 gap-1.5 flex items-center justify-center rounded-full! transition-all duration-200 ease-out text-[14px] font-semibold text-center font-satoshi border';

const defaultClasses = `${commonClasses} border-[var(--divider)]! text-[var(--ink)]! hover:text-[var(--blue)]! hover:border-[var(--blue)]!`;

const dangerClasses = `${commonClasses} border-[var(--danger-border)]! text-[var(--danger-text)]! hover:border-[var(--danger)]! hover:text-[var(--danger)]! hover:bg-[var(--danger-bg)]!`;

const Secondary = ({ danger, ...props }: Readonly<SecondaryProps>) => (
  <BaseButton
    {...props}
    sizeClasses={sizeClasses}
    baseClasses={danger ? dangerClasses : defaultClasses}
  />
);

export default Secondary;
