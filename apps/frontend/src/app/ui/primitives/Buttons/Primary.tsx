import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';
import './ButtonEffects.css';

type PrimaryProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

// Height, horizontal padding and label size travel together per size — the
// font-size lives in ButtonEffects.css because .yc-primary-button sets it with
// !important and a utility class cannot reliably outrank that.
const sizeClasses: Record<ButtonSize, string> = {
  compact: 'min-h-8 px-[14px] yc-primary-button--compact',
  small: 'min-h-9 px-4 yc-primary-button--small',
  default: 'min-h-10 px-[18px]',
  large: 'min-h-11 px-5',
};

const baseClasses =
  'yc-primary-button gap-[7px] flex items-center justify-center rounded-full! transition-[background-color] duration-200 ease-out text-center';

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
