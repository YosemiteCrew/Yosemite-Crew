import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type PrimaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px]',
  large: 'py-[12px] md:py-[15px]',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 text-body-3-emphasis text-center font-satoshi bg-text-primary text-neutral-0!';

const Primary = ({ className, ...rest }: Readonly<PrimaryProps>) => (
  <BaseButton {...rest} className={className} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Primary;
