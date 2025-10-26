import { FormEvent } from "react";
import Link from "next/link";

import "./Buttons.css";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
};

const Secondary = ({ text, href, onClick, style }: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      className="secondary-button"
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
