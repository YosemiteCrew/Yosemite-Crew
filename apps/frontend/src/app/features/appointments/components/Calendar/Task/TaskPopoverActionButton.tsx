import React from 'react';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';

/** Tooltip + round button — the shape every popover footer action shares. */
export const TaskPopoverActionButton = ({
  tooltip,
  label,
  onPress,
  children,
}: {
  tooltip: string;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <GlassTooltip content={tooltip} side="top">
    <button
      type="button"
      title={tooltip}
      aria-label={label}
      className="size-8 rounded-full! flex items-center justify-center text-black-text hover:bg-card-bg border border-card-border"
      onClick={onPress}
    >
      {children}
    </button>
  </GlassTooltip>
);

export default TaskPopoverActionButton;
