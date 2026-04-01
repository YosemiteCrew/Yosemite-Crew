import React from 'react';
import Link from 'next/link';

type ButtonSize = 'default' | 'large';

type PrimaryProps = {
  text: string;
  /** Navigation target. When provided renders a Next.js Link; when omitted renders a <button>. */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  style?: React.CSSProperties;
  className?: string;
  classname?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'py-[12px]',
  large: 'py-[12px] md:py-[15px]',
};

const baseClasses =
  'px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105 text-body-3-emphasis text-center font-satoshi bg-text-primary text-neutral-0!';

const Primary = ({
  text,
  href,
  onClick,
  style,
  className,
  classname,
  isDisabled = false,
  size = 'default',
  type = 'button',
}: Readonly<PrimaryProps>) => {
  const classes = `${sizeClasses[size]} ${baseClasses} ${isDisabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''} ${classname ?? ''}`;

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

export default Primary;
