import React from 'react';
import Link from 'next/link';

type ButtonSize = 'default' | 'large';

type DeleteProps = {
  text: string;
  /** Navigation target. When provided renders a Next.js Link; when omitted renders a <button>. */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  style?: React.CSSProperties;
  classname?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px] text-body-4-emphasis',
  large: 'py-[12px] text-body-4-emphasis md:py-[15px] md:text-body-3-emphasis',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 bg-text-error text-white';

const Delete = ({
  text,
  href,
  onClick,
  style,
  classname,
  isDisabled = false,
  size = 'default',
  type = 'button',
}: Readonly<DeleteProps>) => {
  const classes = `${sizeClasses[size]} ${baseClasses} ${isDisabled ? 'pointer-events-none opacity-60' : ''} ${classname ?? ''}`;

  if (href) {
    return (
      <Link
        href={href}
        aria-disabled={isDisabled}
        className={classes}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          if (onClick) {
            e.preventDefault();
            onClick(e);
          }
        }}
        style={style}
      >
        {text}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={classes}
      onClick={onClick}
      style={style}
    >
      {text}
    </button>
  );
};

export default Delete;
