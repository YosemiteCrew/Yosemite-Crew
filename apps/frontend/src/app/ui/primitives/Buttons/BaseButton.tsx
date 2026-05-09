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
  ariaLabel?: string;
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
  ariaLabel,
  sizeClasses,
  baseClasses,
}: Readonly<BaseButtonProps>) => {
  const classes = `${sizeClasses[size]} ${baseClasses} ${isDisabled ? 'pointer-events-none opacity-60' : ''} ${className ?? ''}`;
  const iconNode = icon ? (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-current [&>svg]:h-[18px] [&>svg]:w-[18px]">
      {icon}
    </span>
  ) : null;
  const updateInteractionPosition = (
    event: React.PointerEvent<HTMLAnchorElement | HTMLButtonElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty('--yc-button-x', `${x}px`);
    event.currentTarget.style.setProperty('--yc-button-y', `${y}px`);
  };

  if (href) {
    return (
      <Link
        href={href}
        aria-disabled={isDisabled}
        aria-label={ariaLabel}
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
        onPointerDown={updateInteractionPosition}
        onPointerMove={updateInteractionPosition}
        style={style}
      >
        <>
          {iconNode}
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
      aria-label={ariaLabel}
      className={classes}
      onClick={onClick}
      onPointerDown={updateInteractionPosition}
      onPointerMove={updateInteractionPosition}
      style={style}
    >
      {iconNode}
      <span>{text}</span>
    </button>
  );
};

export default BaseButton;
