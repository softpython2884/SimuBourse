'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LIMITS, type AuthResponse, type LoginInput, type SessionUser, type SignupInput } from '@alvora/shared';
import { api, setUnauthenticatedHandler } from '@/lib/api';
import { closeSocket } from '@/lib/socket';

interface AuthContextValue {
  user: SessionUser | null;
  /** Short-lived access token, kept in memory only — never in localStorage. */
  token: string | null;
  isReady: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: SessionUser | null }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setReady] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySession = useCallback((response: AuthResponse) => {
    setUser(response.user);
    setToken(response.accessToken);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // Refresh a minute before expiry so a long session never bounces the user to
    // the login page mid-trade.
    const delay = Math.max(30_000, (response.expiresIn - 60) * 1000);
    refreshTimer.current = setTimeout(() => void refresh(), delay);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await api.post<AuthResponse>('/auth/refresh');
      applySession(response);
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setReady(true);
    }
  }, [applySession]);

  useEffect(() => {
    void refresh();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [refresh]);

  const clear = useCallback(() => {
    setUser(null);
    setToken(null);
    queryClient.clear();
    closeSocket();
  }, [queryClient]);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      clear();
    });
    return () => setUnauthenticatedHandler(null);
  }, [clear]);

  const login = useCallback(
    async (input: LoginInput) => {
      applySession(await api.post<AuthResponse>('/auth/login', input));
      await queryClient.invalidateQueries();
      router.refresh();
    },
    [applySession, queryClient, router],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      applySession(await api.post<AuthResponse>('/auth/signup', input));
      await queryClient.invalidateQueries();
      router.refresh();
    },
    [applySession, queryClient, router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
      router.push('/');
      router.refresh();
    }
  }, [clear, router]);

  const value = useMemo(
    () => ({ user, token, isReady, login, signup, logout, refresh }),
    [user, token, isReady, login, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return context;
}

export const SESSION_TTL_MINUTES = LIMITS.accessTokenMinutes;
