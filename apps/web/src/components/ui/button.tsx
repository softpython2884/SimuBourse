import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ComponentPropsWithRef, ReactElement } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Only colour transitions, never layout: a button that resizes on hover makes a
 * dense toolbar feel unstable, and a transition on `height`/`padding` costs a
 * layout pass on every pointer move.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-contrast hover:bg-brand-hover active:bg-brand-hover',
        secondary:
          'border border-border bg-surface-raised text-text hover:border-border-strong hover:bg-surface-sunken active:bg-surface-sunken',
        ghost: 'text-muted hover:bg-surface-sunken hover:text-text active:bg-surface-sunken',
        outline:
          'border border-border-strong bg-transparent text-text hover:border-brand hover:text-brand active:bg-brand-soft',
        danger: 'bg-down text-inverted hover:bg-down/90 active:bg-down/80',
        success: 'bg-up text-inverted hover:bg-up/90 active:bg-up/80',
      },
      size: {
        sm: 'h-7 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-4',
        icon: 'size-9 p-0 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks interaction while a mutation is in flight. */
  loading?: boolean;
  /** Render the single child instead of a `<button>` (links, menu triggers). */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  asChild = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps): ReactElement {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    // Slot forwards to a single child element, so no spinner can be injected.
    return (
      <Slot className={classes} data-loading={loading || undefined} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
