import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type SecondaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px] md:py-[11px]',
  large: 'py-[12px] md:py-[14px]',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out text-body-3-emphasis text-center font-satoshi border border-text-primary! text-text-primary! hover:text-text-brand! hover:border-text-brand!';

const Secondary = (props: Readonly<SecondaryProps>) => (
  <BaseButton {...props} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Secondary;
