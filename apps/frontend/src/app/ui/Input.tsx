import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { getFieldControlClassName } from '@/app/ui/fieldControlStyles';

export type InputProps = {
  error?: boolean;
  placeholder: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'>;

export type TextareaProps = {
  error?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

// React 19 passes `ref` as a normal prop, so no forwardRef wrapper is needed.
const Input = ({ className, error, ref, ...props }: InputProps) => (
  <input
    ref={ref}
    className={clsx(getFieldControlClassName(error), 'h-10 px-3', className)}
    aria-invalid={error || undefined}
    {...props}
  />
);

export const Textarea = ({ className, error, ref, ...props }: TextareaProps) => (
  <textarea
    ref={ref}
    className={clsx(
      getFieldControlClassName(error),
      'min-h-22 resize-y px-3 py-3 leading-relaxed',
      className
    )}
    aria-invalid={error || undefined}
    {...props}
  />
);

export default Input;
