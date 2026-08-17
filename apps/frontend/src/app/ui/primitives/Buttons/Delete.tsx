import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type DeleteProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  compact: 'min-h-8 px-[14px] text-[12px]',
  small: 'min-h-9 px-4 text-[12.5px]',
  default: 'min-h-10 px-[18px] text-[13.5px]',
  large: 'min-h-11 px-5 text-[13.5px]',
};

const baseClasses =
  'gap-[7px] flex items-center justify-center rounded-full! transition-[background-color,opacity] duration-200 ease-out font-semibold text-white bg-[var(--danger-strong)] hover:opacity-90 active:opacity-100';

const Delete = ({ className, ...rest }: Readonly<DeleteProps>) => (
  <BaseButton {...rest} className={className} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Delete;
