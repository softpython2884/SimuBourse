'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSocket, type AlvoraSocket } from '@/lib/socket';
import { useAuth } from './auth-provider';

interface SocketContextValue {
  socket: AlvoraSocket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, isConnected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isReady } = useAuth();
  const [isConnected, setConnected] = useState(false);
  const [socket, setSocket] = useState<AlvoraSocket | null>(null);

  useEffect(() => {
    // Wait for the first refresh so an authenticated user does not connect
    // anonymously and miss their private room.
    if (!isReady) return;

    const instance = getSocket(token);
    setSocket(instance);
    setConnected(instance.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);

    return () => {
      instance.off('connect', onConnect);
      instance.off('disconnect', onDisconnect);
    };
  }, [isReady, token]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
