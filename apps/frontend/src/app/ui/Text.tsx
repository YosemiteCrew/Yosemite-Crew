import type { ElementType, HTMLAttributes } from "react";
import clsx from "clsx";

export type TextVariant =
  | "display-1"
  | "display-2"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "body-1"
  | "body-2"
  | "body-3"
  | "body-3-emphasis"
  | "body-4"
  | "body-4-emphasis"
  | "label-1"
  | "caption-1"
  | "caption-2";

export type TextProps<T extends ElementType> = {
  as?: T;
  variant?: TextVariant;
  className?: string;
} & Omit<HTMLAttributes<HTMLElement>, "as">;

const variantClassMap: Record<TextVariant, string> = {
  "display-1": "text-display-1",
  "display-2": "text-display-2",
  "heading-1": "text-heading-1",
  "heading-2": "text-heading-2",
  "heading-3": "text-heading-3",
  "body-1": "text-body-1",
  "body-2": "text-body-2",
  "body-3": "text-body-3",
  "body-3-emphasis": "text-body-3-emphasis",
  "body-4": "text-body-4",
  "body-4-emphasis": "text-body-4-emphasis",
  "label-1": "text-label-1",
  "caption-1": "text-caption-1",
  "caption-2": "text-caption-2",
};

const Text = <T extends ElementType = "span">({
  as,
  variant = "body-4",
  className,
  ...props
}: TextProps<T>) => {
  const Component = as ?? "span";
  return (
    <Component
      className={clsx(variantClassMap[variant], className)}
      {...props}
    />
  );
};

export default Text;
