'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id' | 'variant'> & { variant?: ToastVariant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

type Action = { type: 'add'; toast: Toast } | { type: 'remove'; id: number };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'add':
      // Cap the stack: a burst of fills should not bury the page in cards.
      return [...state.slice(-4), action.toast];
    case 'remove':
      return state.filter((t) => t.id !== action.id);
  }
}

let nextId = 1;

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastVariant, string> = {
  success: 'border-up/40 bg-up-soft text-text',
  error: 'border-down/40 bg-down-soft text-text',
  warning: 'border-warn/40 bg-warn-soft text-text',
  info: 'border-info/40 bg-info-soft text-text',
};

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-up',
  error: 'text-down',
  warning: 'text-warn',
  info: 'text-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const dismiss = useCallback((id: number) => dispatch({ type: 'remove', id }), []);

  const toast = useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'info' }) => {
      const id = nextId++;
      dispatch({ type: 'add', toast: { id, title, description, variant } });
      setTimeout(() => dispatch({ type: 'remove', id }), variant === 'error' ? 8000 : 5000);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error' }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((item) => {
          const Icon = ICONS[item.variant];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-pop backdrop-blur',
                STYLES[item.variant],
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', ICON_STYLES[item.variant])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-xs text-muted">{item.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-muted transition-colors hover:text-text"
                aria-label="Fermer la notification"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return context;
}
