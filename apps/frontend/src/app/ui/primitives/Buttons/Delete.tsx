import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type DeleteProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px] text-body-4-emphasis',
  large: 'py-[12px] text-body-4-emphasis md:py-[15px] md:text-body-3-emphasis',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 bg-text-error text-white';

const Delete = ({ className, ...rest }: Readonly<DeleteProps>) => (
  <BaseButton {...rest} className={className} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Delete;
