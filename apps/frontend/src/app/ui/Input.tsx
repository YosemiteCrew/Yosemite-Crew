import type { InputHTMLAttributes } from "react";
import clsx from "clsx";

export type InputProps = {
  error?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

const Input = ({ className, error, ...props }: InputProps) => {
  return (
    <input
      className={clsx(
        "w-full min-h-12 rounded-2xl bg-transparent px-6 py-2.5 text-body-4 text-text-primary outline-none border",
        error ? "border-input-border-error" : "border-input-border-default",
        "focus:border-input-border-active",
        className
      )}
      {...props}
    />
  );
};

export default Input;
