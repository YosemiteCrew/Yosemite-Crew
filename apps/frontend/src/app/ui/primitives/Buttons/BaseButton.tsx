import React from 'react';
import Link from 'next/link';

export type ButtonSize = 'default' | 'large';

export type BaseButtonProps = {
  text: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  style?: React.CSSProperties;
  className?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  sizeClasses: Record<ButtonSize, string>;
  baseClasses: string;
};

const BaseButton = ({
  text,
  icon,
  href,
  onClick,
  style,
  className,
  isDisabled = false,
  size = 'default',
  type = 'button',
  sizeClasses,
  baseClasses,
}: Readonly<BaseButtonProps>) => {
  const classes = `${sizeClasses[size]} ${baseClasses} ${isDisabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`;

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
        <>
          {icon}
          <span>{text}</span>
        </>
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
      <>
        {icon}
        <span>{text}</span>
      </>
    </button>
  );
};

export default BaseButton;
