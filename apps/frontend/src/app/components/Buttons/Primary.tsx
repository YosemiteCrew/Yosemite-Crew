import { FormEvent } from "react";
import Link from "next/link";

import "./Buttons.css";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  classname?: string;
  isDisabled?: boolean;
};

const Primary = ({
  text,
  href,
  onClick,
  style,
  classname,
  isDisabled = false,
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      aria-disabled={isDisabled}
      className={`primary-button ${isDisabled ? "pointer-events-none opacity-60" : ""} ${classname ?? ""}`}
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

export default Primary;
