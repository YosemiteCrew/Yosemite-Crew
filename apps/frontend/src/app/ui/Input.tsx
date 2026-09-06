import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import { getFieldControlClassName } from '@/app/ui/fieldControlStyles';

export type InputProps = {
  error?: boolean;
  placeholder: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'>;

export type TextareaProps = {
  error?: boolean;
  placeholder: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'placeholder'>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={clsx(getFieldControlClassName(error), 'h-10 px-3', className)}
    aria-invalid={error || undefined}
    {...props}
  />
));

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
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
  )
);

Textarea.displayName = 'Textarea';

export default Input;
