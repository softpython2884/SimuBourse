'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiRequestError } from '@/lib/api';
import { AuthProvider } from './auth-provider';
import { SocketProvider } from './socket-provider';
import { ToastProvider } from '@/components/ui/toast';
import type { SessionUser } from '@alvora/shared';

export function Providers({ children, initialUser }: { children: ReactNode; initialUser: SessionUser | null }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Prices arrive over the socket, so polling is redundant; a short
            // stale time still de-duplicates the burst of requests a page makes
            // as its widgets mount.
            staleTime: 15_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry(failureCount, error) {
              if (error instanceof ApiRequestError) {
                // Retrying a rejected order or an unauthenticated call only
                // wastes a round trip — and could double-submit.
                if (error.status >= 400 && error.status < 500) return false;
              }
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider initialUser={initialUser}>
        <SocketProvider>
          <ToastProvider>{children}</ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
