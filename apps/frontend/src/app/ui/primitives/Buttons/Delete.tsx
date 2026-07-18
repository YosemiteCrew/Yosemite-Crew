import React from 'react';
import BaseButton, { ButtonSize, BaseButtonProps } from '@/app/ui/primitives/Buttons/BaseButton';

type DeleteProps = Omit<BaseButtonProps, 'sizeClasses' | 'baseClasses'>;

const sizeClasses: Record<ButtonSize, string> = {
  default: 'min-h-10',
  large: 'min-h-11',
};

const baseClasses =
  'px-5 gap-1.5 flex items-center justify-center rounded-full! transition-[background-color,opacity] duration-200 ease-out text-[14px] font-semibold text-white bg-[var(--danger)] hover:opacity-90 active:opacity-100';

const Delete = ({ className, ...rest }: Readonly<DeleteProps>) => (
  <BaseButton {...rest} className={className} sizeClasses={sizeClasses} baseClasses={baseClasses} />
);

export default Delete;
