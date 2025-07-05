'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: useEffect démarré. Mise en place du listener onAuthStateChanged.');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('onAuthStateChanged déclenché. Objet utilisateur :', user);
      setUser(user);
      setLoading(false);
      console.log('AuthProvider: État mis à jour. Le chargement est maintenant terminé.');
    }, (error) => {
      console.error('Erreur onAuthStateChanged :', error);
      setLoading(false);
    });

    return () => {
      console.log('AuthProvider: Nettoyage du listener onAuthStateChanged.');
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
