import { FormEvent } from "react";
import Link from "next/link";

import "./Buttons.css";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  className?: string;
};

const Secondary = ({
  text,
  href,
  onClick,
  style,
  className,
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      className={`secondary-button ${className}`}
      onClick={(e) => {
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
