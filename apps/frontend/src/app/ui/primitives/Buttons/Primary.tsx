import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';
import './ButtonEffects.css';

type PrimaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-10',
  large: 'min-h-11',
};

const baseClasses =
  'yc-primary-button px-5 gap-2 flex items-center justify-center rounded-full! transition-[background-color,border-color] duration-200 ease-out text-center';

const Primary = ({ className, style, ...rest }: Readonly<PrimaryProps>) => (
  <BaseButton
    {...rest}
    className={className}
    style={{ backgroundColor: 'var(--cta)', ...style }}
    sizeClasses={sizeClasses}
    baseClasses={baseClasses}
  />
);

export default Primary;
