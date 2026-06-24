import React from 'react';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

export type CircleIconVariant = 'dark' | 'outline' | 'danger';
type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

type CircleIconButtonProps = {
  icon: React.ReactNode;
  label: string;
  variant?: CircleIconVariant;
  onClick: () => void;
  disabled?: boolean;
  /** Optional hover tooltip. When omitted, the button's `label` is used as the tooltip. */
  tooltip?: React.ReactNode;
  /** Tooltip side, defaults to `top`. */
  tooltipSide?: TooltipSide;
  /** Set to false to opt out of the hover tooltip entirely. */
  showTooltip?: boolean;
};

const VARIANT_CLASSES: Record<CircleIconVariant, string> = {
  dark: 'bg-neutral-900 text-neutral-0 hover:opacity-90',
  outline: 'border border-neutral-300 text-neutral-900 hover:bg-neutral-100',
  danger: 'border border-danger-600 text-danger-600 hover:bg-neutral-100',
};

/**
 * Circular action icon used across the workspace: dark filled (view/hide),
 * outlined (edit/reschedule/download), or red-outlined (delete). Shows a reusable
 * glass tooltip on hover (defaults to `label`).
 */
const CircleIconButton = ({
  icon,
  label,
  variant = 'outline',
  onClick,
  disabled = false,
  tooltip,
  tooltipSide = 'bottom',
  showTooltip = true,
}: CircleIconButtonProps) => {
  const button = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]}`}
    >
      {icon}
    </button>
  );

  const tooltipContent = tooltip ?? label;
  if (!showTooltip || !tooltipContent) return button;

  return (
    <GlassTooltip content={tooltipContent} side={tooltipSide}>
      {button}
    </GlassTooltip>
  );
};

export default CircleIconButton;
