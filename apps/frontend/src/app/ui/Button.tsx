import type { CSSProperties, FormEvent } from "react";
import Primary from "@/app/ui/primitives/Buttons/Primary";
import Secondary from "@/app/ui/primitives/Buttons/Secondary";
import Delete from "@/app/ui/primitives/Buttons/Delete";

export type ButtonVariant = "primary" | "secondary" | "danger";
export type ButtonSize = "default" | "large";

export type ButtonProps = {
  text: string;
  href: string;
  onClick?: (e: FormEvent<Element>) => void;
  style?: CSSProperties;
  className?: string;
  isDisabled?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const Button = ({
  variant = "primary",
  className,
  ...rest
}: Readonly<ButtonProps>) => {
  if (variant === "secondary") {
    return <Secondary {...rest} className={className} />;
  }

  if (variant === "danger") {
    return <Delete {...rest} classname={className} />;
  }

  return <Primary {...rest} classname={className} />;
};

export default Button;
