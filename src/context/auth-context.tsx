'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { getSession, deleteSession } from '@/lib/session';

export type User = {
  id: number;
  displayName: string;
  email: string;
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserSession() {
      try {
        const sessionUser = await getSession();
        setUser(sessionUser);
      } catch (e) {
        console.error("Failed to fetch session", e);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchUserSession();
  }, []);

  const logout = async () => {
    // deleteSession handles redirecting the user
    await deleteSession();
  };

  const value = {
    user,
    loading,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
