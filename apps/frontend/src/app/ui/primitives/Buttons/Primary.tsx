import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';
import './ButtonEffects.css';

type PrimaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px]',
  large: 'py-[12px] md:py-[15px]',
};

const baseClasses =
  'yc-primary-button px-8 flex items-center justify-center rounded-2xl! transition-[background-color,border-color] duration-200 ease-out text-body-3-emphasis text-center font-satoshi text-neutral-0!';

const Primary = ({ className, style, ...rest }: Readonly<PrimaryProps>) => (
  <BaseButton
    {...rest}
    className={className}
    style={{ backgroundColor: 'var(--color-text-primary)', ...style }}
    sizeClasses={sizeClasses}
    baseClasses={baseClasses}
  />
);

export default Primary;
