import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type BadgeProps = {
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  className?: string;
} & HTMLAttributes<HTMLSpanElement>;

const toneClassMap: Record<NonNullable<BadgeProps["tone"]>, string> = {
  neutral: "bg-card-bg text-text-secondary",
  brand: "bg-brand-100 text-text-brand",
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
};

const Badge = ({ tone = "neutral", className, ...props }: BadgeProps) => {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-caption-1",
        toneClassMap[tone],
        className
      )}
      {...props}
    />
  );
};

export default Badge;
