import { FormEvent } from "react";
import Link from "next/link";

import "./Buttons.css";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  className?: string;
  isDisabled?: boolean;
};

const Secondary = ({
  text,
  href,
  onClick,
  style,
  className,
  isDisabled = false,
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      aria-disabled={isDisabled}
      className={`secondary-button ${isDisabled ? "pointer-events-none opacity-60" : ""} ${className ?? ""}`}
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
