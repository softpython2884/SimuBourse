import type { ComponentPropsWithRef, ReactElement } from 'react';
import { cn } from '@/lib/utils';

const FIELD_BASE =
  'w-full rounded-md border border-border bg-surface-sunken text-sm text-text placeholder:text-faint transition-[border-color,background-color,box-shadow] duration-150 hover:border-border-strong focus:border-brand disabled:cursor-not-allowed disabled:opacity-60';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps): ReactElement {
  return (
    <input
      className={cn(FIELD_BASE, 'h-9 px-3', invalid && 'border-down hover:border-down focus:border-down', className)}
      aria-invalid={invalid || props['aria-invalid']}
      {...props}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, rows = 4, ...props }: TextareaProps): ReactElement {
  return (
    <textarea
      rows={rows}
      className={cn(
        FIELD_BASE,
        'min-h-20 resize-y px-3 py-2 leading-relaxed',
        invalid && 'border-down hover:border-down focus:border-down',
        className,
      )}
      aria-invalid={invalid || props['aria-invalid']}
      {...props}
    />
  );
}
