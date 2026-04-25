import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type DeleteProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px] text-body-4-emphasis',
  large: 'py-[12px] text-body-4-emphasis md:py-[15px] md:text-body-3-emphasis',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out bg-text-error text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_rgba(234,55,41,0.16)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_0_1px_rgba(255,255,255,0.18),0_12px_30px_rgba(234,55,41,0.24)] active:translate-y-px active:shadow-[inset_0_2px_8px_rgba(255,255,255,0.16),0_6px_16px_rgba(234,55,41,0.18)]';

const Delete = ({ className, ...rest }: Readonly<DeleteProps>) => (
  <BaseButton {...rest} className={className} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Delete;
