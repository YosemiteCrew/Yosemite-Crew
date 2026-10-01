import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { FIELD_CONTROL_HEIGHT, getFieldControlClassName } from '@/app/ui/fieldControlStyles';

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
// A read-only or disabled input is a read-out rather than something to tap, so it
// keeps the 40px field height on touch screens.
const READ_ONLY_HEIGHT = 'max-sm:read-only:h-10 pointer-coarse:read-only:h-10';

const Input = ({ className, error, ref, ...props }: InputProps) => (
  <input
    ref={ref}
    className={clsx(
      getFieldControlClassName(error),
      FIELD_CONTROL_HEIGHT,
      READ_ONLY_HEIGHT,
      'px-3',
      className
    )}
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
