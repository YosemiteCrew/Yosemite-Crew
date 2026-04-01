import type { CSSProperties, MouseEventHandler } from 'react';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import Delete from '@/app/ui/primitives/Buttons/Delete';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'default' | 'large';

export type ButtonProps = {
  text: string;
  /**
   * Navigation target. When provided the button renders as a Next.js Link (<a>).
   * When omitted the button renders as a semantic <button> element.
   * Prefer omitting href for action buttons (submit, confirm, cancel, delete).
   * Use href only for navigation.
   */
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  style?: CSSProperties;
  className?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  /** HTML button type. Only applies when href is not provided. Defaults to "button". */
  type?: 'button' | 'submit' | 'reset';
};

/**
 * Button — status: Approved
 *
 * Shared action and navigation trigger component.
 *
 * - Use variant="primary" for the main CTA on a surface.
 * - Use variant="secondary" for alternative / cancel actions.
 * - Use variant="danger" for destructive confirmations.
 * - Pass href for navigation; omit href for in-page actions.
 */
const Button = ({ variant = 'primary', className, ...rest }: Readonly<ButtonProps>) => {
  if (variant === 'secondary') {
    return <Secondary {...rest} className={className} />;
  }

  if (variant === 'danger') {
    return <Delete {...rest} classname={className} />;
  }

  return <Primary {...rest} classname={className} />;
};

export default Button;
