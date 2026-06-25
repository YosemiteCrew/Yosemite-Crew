import React from 'react';
import Link from 'next/link';

export type ButtonSize = 'default' | 'large';

export type BaseButtonProps = {
  text: string;
  icon?: React.ReactNode;
  /** Render the icon after the text (e.g. trailing "→"). Defaults to `left`. */
  iconPosition?: 'left' | 'right';
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

const updateInteractionPosition = (
  event: React.PointerEvent<HTMLAnchorElement | HTMLButtonElement>
) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  event.currentTarget.style.setProperty('--yc-button-x', `${x}px`);
  event.currentTarget.style.setProperty('--yc-button-y', `${y}px`);
};

const BaseButton = ({
  text,
  icon,
  iconPosition = 'left',
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
    <span className="inline-flex size-5 shrink-0 items-center justify-center text-current [&>svg]:h-[18px] [&>svg]:w-[18px]">
      {icon}
    </span>
  ) : null;
  const content = (
    <>
      {iconPosition === 'left' && iconNode}
      <span>{text}</span>
      {iconPosition === 'right' && iconNode}
    </>
  );
  const normalizedHref = href?.trim();
  const isLink = normalizedHref !== undefined && normalizedHref !== '' && normalizedHref !== '#';

  if (isLink) {
    return (
      <Link
        href={normalizedHref}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : undefined}
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
        {content}
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
      {content}
    </button>
  );
};

export default BaseButton;
