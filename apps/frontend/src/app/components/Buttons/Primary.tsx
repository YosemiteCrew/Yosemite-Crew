import { FormEvent } from "react";
import Link from "next/link";

import "./Buttons.css";

type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: React.CSSProperties;
  classname?: string;
};

const Primary = ({
  text,
  href,
  onClick,
  style,
  classname,
}: Readonly<ButtonProps>) => {
  return (
    <Link
      href={href}
      className={`primary-button ${classname}`}
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

export default Primary;
