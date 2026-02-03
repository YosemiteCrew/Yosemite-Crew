import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type StackProps = {
  direction?: "row" | "column";
  gap?: number | string;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  wrap?: boolean;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

const alignClassMap: Record<NonNullable<StackProps["align"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const justifyClassMap: Record<NonNullable<StackProps["justify"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

const Stack = ({
  direction = "column",
  gap = 3,
  align = "start",
  justify = "start",
  wrap = false,
  className,
  style,
  ...props
}: StackProps) => {
  return (
    <div
      className={clsx(
        "flex",
        direction === "row" ? "flex-row" : "flex-col",
        alignClassMap[align],
        justifyClassMap[justify],
        wrap && "flex-wrap",
        className
      )}
      style={{ ...style, gap: typeof gap === "number" ? `${gap * 4}px` : gap }}
      {...props}
    />
  );
};

export default Stack;
