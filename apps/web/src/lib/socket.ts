'use client';

import { io, type Socket } from 'socket.io-client';
import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from '@alvora/shared';

export type AlvoraSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AlvoraSocket | null = null;

/**
 * One shared connection for the whole tab.
 *
 * Opening a socket per component is the mistake that turns a page with six live
 * widgets into six connections; every hook subscribes to rooms on this one.
 */
export function getSocket(token?: string | null): AlvoraSocket {
  if (socket) {
    if (token && socket.auth && (socket.auth as { token?: string }).token !== token) {
      socket.auth = { token };
      // Reconnect so the server re-runs the handshake with the new identity.
      socket.disconnect().connect();
    }
    return socket;
  }

  const url = process.env.NEXT_PUBLIC_WS_URL || undefined;

  socket = io(url ?? '/', {
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8_000,
    // Unbounded retries: a market app should recover from a laptop lid closing.
    reconnectionAttempts: Infinity,
    timeout: 12_000,
  });

  return socket;
}

export function closeSocket(): void {
  socket?.close();
  socket = null;
}
