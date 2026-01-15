import { FormEvent } from "react";
import Link from "next/link";

type ButtonSize = "default" | "large";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  classname?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "py-[12px] text-body-4-emphasis",
  large:
    "py-[12px] text-body-4-emphasis md:py-[15px] md:text-body-3-emphasis",
};

const Delete = ({
  text,
  href,
  onClick,
  style,
  classname,
  isDisabled = false,
  size = "default",
}: Readonly<ButtonProps>) => {
  const baseClasses =
    "px-8 flex items-center justify-center rounded-2xl! transition-all duration-300 ease-in-out hover:scale-105";

  return (
    <Link
      href={href}
      aria-disabled={isDisabled}
      className={`${sizeClasses[size]} ${baseClasses} bg-text-error text-white ${isDisabled ? "pointer-events-none opacity-60" : ""} ${classname ?? ""}`}
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

export default Delete;
