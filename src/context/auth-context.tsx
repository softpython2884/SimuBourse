'use client';

import { createContext, useContext, ReactNode } from 'react';
// import { User } from 'firebase/auth'; // Remplacé

// Un type utilisateur simple pour la transition. Sera étoffé plus tard.
export type User = {
  id: number;
  displayName: string;
  email: string;
}

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

// Contexte temporaire qui simule un utilisateur non connecté.
// Il sera remplacé par une gestion de session (ex: JWT) dans les prochaines étapes.
const AuthContext = createContext<AuthContextType>({ user: null, loading: false });

export const AuthProvider = ({ children }: { children: ReactNode }) => {

  const value = {
    user: null, // L'utilisateur est toujours déconnecté pour l'instant
    loading: false, // Le chargement est terminé
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
