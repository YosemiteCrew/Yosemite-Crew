import { FormEvent } from "react";
import Link from "next/link";

type ButtonSize = "default" | "large";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  className?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "py-[11px] text-body-4-emphasis",
  large: "py-[14px] text-body-3-emphasis",
};

const Secondary = ({
  text,
  href,
  onClick,
  style,
  className,
  isDisabled = false,
  size = "default",
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      aria-disabled={isDisabled}
      className={`${sizeClasses[size]} px-8 border border-text-primary! text-text-primary! flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:text-text-brand! hover:border-text-brand! ${isDisabled ? "pointer-events-none opacity-60" : ""} ${className ?? ""}`}
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
};

export default Secondary;
