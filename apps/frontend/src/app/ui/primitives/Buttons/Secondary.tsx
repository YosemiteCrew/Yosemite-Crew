import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type SecondaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'> & {
  /** Red outlined variant — red border, text and icon. Use for destructive actions. */
  danger?: boolean;
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[11px]',
  large: 'py-[11px]',
};

const commonClasses =
  'px-4 gap-2 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out text-body-3-emphasis text-center font-satoshi border';

const defaultClasses = `${commonClasses} border-text-primary! text-text-primary! hover:text-text-brand! hover:border-text-brand!`;

const dangerClasses = `${commonClasses} border-text-error! text-text-error! hover:border-text-error! hover:text-text-error! hover:bg-danger-50!`;

const Secondary = ({ danger, ...props }: Readonly<SecondaryProps>) => (
  <BaseButton
    {...props}
    sizeClasses={sizeClasses}
    baseClasses={danger ? dangerClasses : defaultClasses}
  />
);

export default Secondary;
